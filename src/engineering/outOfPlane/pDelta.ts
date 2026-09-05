// src/engineering/outOfPlane/pDelta.ts

import { CodeReference, CalculationStep } from '../../domain/model/types';
import { UnitConverter } from '../units/conversion';

const NZS3101_OOP: CodeReference = {
  id: 'NZS3101-11.4',
  standard: 'NZS 3101.1',
  edition: '2006+A3',
  clause: '11.4',
  description: 'Walls subjected to out-of-plane loading and P-Delta effects'
};

export interface PDeltaInput {
  L_mm: number;           // Panel height / support spacing (mm)
  N_star_kN: number;      // Axial load at mid-height (kN)
  w_star_kPa: number;     // Factored out-of-plane uniform pressure (kPa)
  EI_eff_Nmm2: number;    // Effective flexural stiffness (N·mm²)
  supportCondition: 'pinned-pinned' | 'fixed-pinned' | 'fixed-fixed';
  maxIterations: number;
  tolerance_mm: number;
}

export interface PDeltaResult {
  converged: boolean;
  iterations: number;
  M0_kNm: number;         // First-order moment
  M_final_kNm: number;    // Final moment including P-Delta
  delta_max_mm: number;   // Maximum deflection
  steps: CalculationStep[];
}

export class PDeltaEngine {
  private getMomentCoefficient(condition: string): number {
    switch (condition) {
      case 'fixed-pinned': return 0.070; // Approx for mid-height
      case 'fixed-fixed': return 0.042;
      case 'pinned-pinned': 
      default: return 0.125; // wL^2 / 8
    }
  }

  private getDeflectionCoefficient(condition: string): number {
    switch (condition) {
      case 'fixed-pinned': return 0.0054; // Approx
      case 'fixed-fixed': return 0.0026;
      case 'pinned-pinned': 
      default: return 0.01302; // 5/384
    }
  }

  public solve(input: PDeltaInput): PDeltaResult {
    const { L_mm, N_star_kN, w_star_kPa, EI_eff_Nmm2, supportCondition, maxIterations, tolerance_mm } = input;
    const steps: CalculationStep[] = [];

    // Convert w_star from kPa (kN/m²) to N/mm (line load on 1m strip or specific width)
    // Assuming calculation is per 1 meter width of panel for simplicity, or w_star is already line load.
    // Let's assume w_star is kN/m (line load) for this calculation module.
    const w_N_per_mm = w_star_kPa * 1.0; // If w_star_kPa is kN/m², for 1m width it's kN/m. Convert to N/mm: * 1000 / 1000 = 1.
    // Actually, 1 kPa = 1 kN/m². For a 1m wide strip, w = 1 kN/m = 1 N/mm.
    
    const C_m = this.getMomentCoefficient(supportCondition);
    const C_d = this.getDeflectionCoefficient(supportCondition);

    // First-order moment (M0) in N·mm
    const M0_Nmm = C_m * w_N_per_mm * Math.pow(L_mm, 2);
    const M0_kNm = UnitConverter.nmmToKNm(M0_Nmm);

    let delta_current_mm = 0;
    let M_current_Nmm = M0_Nmm;
    let converged = false;
    let iteration = 0;

    for (iteration = 1; iteration <= maxIterations; iteration++) {
      // Calculate deflection based on current moment
      // Δ = C_d * (M_total * L^2) / EI  (Simplified curvature integration)
      // More accurately: Δ = C_d * (w * L^4) / EI + (P * Δ * L^2) / (C * EI)
      // Using equivalent moment method for simplicity in this iteration:
      const delta_new_mm = (C_d * M_current_Nmm * Math.pow(L_mm, 2)) / EI_eff_Nmm2;

      // Check convergence
      if (Math.abs(delta_new_mm - delta_current_mm) < tolerance_mm) {
        converged = true;
        delta_current_mm = delta_new_mm;
        break;
      }

      delta_current_mm = delta_new_mm;

      // Calculate P-Delta additional moment: M_add = N * Δ
      // N_star_kN to N: * 1000
      const N_N = UnitConverter.kNToN(N_star_kN);
      const M_add_Nmm = N_N * delta_current_mm;
      
      M_current_Nmm = M0_Nmm + M_add_Nmm;
    }

    steps.push({
      id: 'p-delta-iteration',
      title: 'P-Delta Iterative Convergence',
      equation: 'Δ_i = f(M_i / EI_eff); M_{i+1} = M_0 + N^* × Δ_i',
      variables: {
        'M0': `${M0_kNm.toFixed(2)} kNm`,
        'N_star': `${N_star_kN} kN`,
        'EI_eff': `${(EI_eff_Nmm2 / 1e9).toFixed(2)} × 10^9 N·mm²`,
        'iterations': iteration,
        'tolerance': `${tolerance_mm} mm`
      },
      result: converged ? 'Converged' : 'Not Converged',
      units: '-',
      source: [NZS3101_OOP]
    });

    return {
      converged,
      iterations: iteration,
      M0_kNm,
      M_final_kNm: UnitConverter.nmmToKNm(M_current_Nmm),
      delta_max_mm: delta_current_mm,
      steps
    };
  }
}