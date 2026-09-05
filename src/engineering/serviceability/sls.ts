// src/engineering/serviceability/sls.ts

import { CodeReference, CheckResult, CalculationStep } from '../../domain/model/types';
import { UnitConverter } from '../units/conversion';

const NZS3101_SLS: CodeReference = {
  id: 'NZS3101-3.6',
  standard: 'NZS 3101.1',
  edition: '2006+A3',
  clause: '3.6',
  description: 'Serviceability limit states (deflection and cracking)'
};

const BRANZ_SLS_DEFLECTION: CodeReference = {
  id: 'BRANZ-2007-Sec7',
  standard: 'BRANZ Slender Precast Concrete Panels',
  edition: '2007',
  clause: 'Section 7',
  description: 'Serviceability deflection limits for slender panels'
};

export interface SLSDeflectionInput {
  L_mm: number;               // Panel height / span (mm)
  w_sls_kPa: number;          // SLS face load (kPa -> kN/m²)
  N_sls_kN: number;           // SLS axial load (kN, compression positive)
  EI_eff_Nmm2: number;        // Effective flexural stiffness for SLS (N·mm²)
  N_cr_kN: number;            // Euler critical buckling load (kN) for P-Delta amplification
  deflectionLimitRatio: number; // e.g., 400 for H/400
  supportCondition: 'pinned-pinned' | 'fixed-pinned' | 'fixed-fixed';
}

export class SLSEngine {
  private getDeflectionCoefficient(condition: string): number {
    switch (condition) {
      case 'fixed-pinned': return 0.0054; 
      case 'fixed-fixed': return 0.0026;
      case 'pinned-pinned': 
      default: return 0.01302; // 5/384
    }
  }

  public checkDeflection(input: SLSDeflectionInput): { checks: CheckResult[]; steps: CalculationStep[] } {
    const { L_mm, w_sls_kPa, N_sls_kN, EI_eff_Nmm2, N_cr_kN, deflectionLimitRatio, supportCondition } = input;
    const checks: CheckResult[] = [];
    const steps: CalculationStep[] = [];

    const C_d = this.getDeflectionCoefficient(supportCondition);
    
    // Convert w_sls from kPa (kN/m²) to N/mm (assuming 1m width strip)
    // 1 kPa = 1 kN/m² = 1 N/mm (for 1m width)
    const w_N_per_mm = w_sls_kPa; 

    // 1. First-order elastic deflection (Δ_0)
    // Δ_0 = C_d * (w * L^4) / EI
    const delta_0_mm = (C_d * w_N_per_mm * Math.pow(L_mm, 4)) / EI_eff_Nmm2;

    // 2. P-Delta Amplification for SLS
    // Amplification factor = 1 / (1 - N_sls / N_cr)
    // If N_sls approaches N_cr, deflection grows infinitely (buckling).
    let amplificationFactor = 1.0;
    if (N_cr_kN > 0 && N_sls_kN > 0) {
      const ratio = N_sls_kN / N_cr_kN;
      if (ratio >= 0.95) {
        amplificationFactor = 20.0; // Cap amplification to prevent numerical explosion, flag as warning
      } else {
        amplificationFactor = 1.0 / (1.0 - ratio);
      }
    }

    const delta_final_mm = delta_0_mm * amplificationFactor;
    const limit_mm = L_mm / deflectionLimitRatio;

    steps.push({
      id: 'sls-deflection-calc',
      title: 'Out-of-Plane Serviceability Deflection',
      equation: 'Δ = Δ_0 × [1 / (1 - N*/N_cr)]',
      variables: {
        'Δ_0 (1st order)': `${delta_0_mm.toFixed(2)} mm`,
        'N*_sls / N_cr': `${(N_sls_kN / N_cr_kN).toFixed(3)}`,
        'Amplification': `${amplificationFactor.toFixed(2)}`,
        'Δ_final': `${delta_final_mm.toFixed(2)} mm`,
        'Limit (H/' + deflectionLimitRatio + ')': `${limit_mm.toFixed(2)} mm`
      },
      result: delta_final_mm,
      units: 'mm',
      source: [NZS3101_SLS, BRANZ_SLS_DEFLECTION]
    });

    // 3. Deflection Check
    const deflectionCheck: CheckResult = {
      id: 'sls-deflection',
      title: 'OOP Serviceability Deflection',
      demand: delta_final_mm,
      capacity: limit_mm,
      utilisation: delta_final_mm / limit_mm,
      status: delta_final_mm <= limit_mm ? 'PASS' : 'FAIL',
      units: 'mm',
      source: [BRANZ_SLS_DEFLECTION],
      governing: false // Usually ULS governs, but tracked here
    };
    checks.push(deflectionCheck);

    // 4. P-Delta Instability Warning
    if (amplificationFactor >= 20.0) {
      checks.push({
        id: 'sls-pdelta-warning',
        title: 'SLS P-Delta Amplification Excessive',
        demand: N_sls_kN,
        capacity: N_cr_kN * 0.95,
        utilisation: N_sls_kN / (N_cr_kN * 0.95),
        status: 'WARNING',
        units: 'kN',
        source: [NZS3101_SLS],
        governing: false
      });
    }

    return { checks, steps };
  }
}