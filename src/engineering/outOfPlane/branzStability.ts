// src/engineering/outOfPlane/branzStability.ts

import { CodeReference, CheckResult, CalculationStep } from '../../domain/model/types';

const BRANZ_2007_SCOPE: CodeReference = {
  id: 'BRANZ-2007-Sec3',
  standard: 'BRANZ Slender Precast Concrete Panels',
  edition: '2007',
  clause: 'Section 3',
  description: 'Scope and limitations of the slender panel design guide'
};

const BRANZ_2007_STABILITY: CodeReference = {
  id: 'BRANZ-2007-Sec5',
  standard: 'BRANZ Slender Precast Concrete Panels',
  edition: '2007',
  clause: 'Section 5',
  description: 'Stability checks for low axial load panels'
};

export interface BranzStabilityInput {
  H_mm: number;           // Panel height (mm)
  t_mm: number;           // Panel thickness (mm)
  N_star_kN: number;      // Applied axial load (kN)
  N_cr_kN: number;        // Euler critical buckling load (kN)
  phi: number;            // Capacity reduction factor
  rho: number;            // Reinforcement ratio (%)
  fy_MPa: number;         // Reinforcement yield strength (MPa)
  fc_MPa: number;         // Concrete compressive strength (MPa)
}

export class BranzStabilityEngine {
  public checkScopeAndStability(input: BranzStabilityInput): { checks: CheckResult[]; steps: CalculationStep[] } {
    const { H_mm, t_mm, N_star_kN, N_cr_kN, phi, rho, fy_MPa, fc_MPa } = input;
    const checks: CheckResult[] = [];
    const steps: CalculationStep[] = [];

    const H_over_t = H_mm / t_mm;

    // 1. Scope Check: H/t ratio
    const scopeHtCheck: CheckResult = {
      id: 'branz-scope-ht',
      title: 'BRANZ Scope: Height-to-Thickness Ratio',
      demand: H_over_t,
      capacity: 30, // BRANZ guide typically recommends H/t <= 30 for slender panels without special edge support
      utilisation: H_over_t / 30,
      status: H_over_t <= 30 ? 'PASS' : 'OUT_OF_SCOPE',
      units: '-',
      source: [BRANZ_2007_SCOPE],
      governing: true
    };
    checks.push(scopeHtCheck);

    // 2. Scope Check: Low Axial Load definition
    // BRANZ defines "low axial load" roughly as N* < 0.1 * fc' * Ag
    const Ag_mm2 = H_mm * t_mm; // Actually width * t, assuming unit width 1000mm for Ag
    const width_mm = 1000; 
    const Ag_unit_mm2 = width_mm * t_mm;
    const lowAxialLimit_kN = 0.1 * fc_MPa * Ag_unit_mm2 / 1000; // kN

    const scopeAxialCheck: CheckResult = {
      id: 'branz-scope-axial',
      title: 'BRANZ Scope: Low Axial Load Limit',
      demand: N_star_kN,
      capacity: lowAxialLimit_kN,
      utilisation: N_star_kN / lowAxialLimit_kN,
      status: N_star_kN <= lowAxialLimit_kN ? 'PASS' : 'OUT_OF_SCOPE',
      units: 'kN',
      source: [BRANZ_2007_SCOPE],
      governing: true
    };
    checks.push(scopeAxialCheck);

    // 3. Stability Check: Euler-based compression strut approach
    // Design capacity = phi * N_cr
    const capacity_N_cr_kN = phi * N_cr_kN;
    const stabilityUtilisation = N_star_kN / capacity_N_cr_kN;

    const stabilityCheck: CheckResult = {
      id: 'branz-stability-euler',
      title: 'BRANZ Stability: Euler Compression-Strut',
      demand: N_star_kN,
      capacity: capacity_N_cr_kN,
      utilisation: stabilityUtilisation,
      status: stabilityUtilisation <= 1.0 ? 'PASS' : 'FAIL',
      units: 'kN',
      source: [BRANZ_2007_STABILITY],
      governing: true
    };
    checks.push(stabilityCheck);

    steps.push({
      id: 'branz-stability-calc',
      title: 'BRANZ Stability Parameters',
      equation: 'N_{cr} = π² EI / (kH)²',
      variables: {
        'H/t': H_over_t.toFixed(1),
        'Low Axial Limit': `${lowAxialLimit_kN.toFixed(1)} kN`,
        'φN_{cr}': `${capacity_N_cr_kN.toFixed(1)} kN`
      },
      result: stabilityCheck.status,
      units: '-',
      source: [BRANZ_2007_STABILITY]
    });

    return { checks, steps };
  }
}