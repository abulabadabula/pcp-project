// src/engineering/foundation/partialContact.ts

import { CheckResult, CalculationStep, CodeReference } from '../../domain/model/types';
import { UnitConverter } from '../units/conversion';

const NZS3101_FOUNDATION: CodeReference = {
  id: 'NZS3101-12.6',
  standard: 'NZS 3101.1',
  edition: '2006+A3',
  clause: '12.6',
  description: 'Foundation bearing and load transfer'
};

export interface FoundationDemandInput {
  N_star_kN: number;   // Axial load at base (kN, compression positive)
  M_star_kNm: number;  // Moment demand at base (kNm)
  width_mm: number;    // Panel width (mm) - usually 1000mm for per-meter strip
  thickness_mm: number;// Panel thickness (mm)
  q_allowable_kPa: number; // Allowable bearing pressure from geotechnical report (kPa)
}

export interface PartialContactResult {
  isPartialContact: boolean;
  eccentricity_mm: number;
  contactWidth_mm: number; // Length of the compression zone
  q_max_kPa: number;       // Maximum bearing pressure
  q_min_kPa: number;       // Minimum bearing pressure (0 if partial contact)
  T_star_kN: number;       // Required hold-down tension demand (kN)
  checks: CheckResult[];
  steps: CalculationStep[];
}

export class FoundationInterfaceEngine {
  public analyze(input: FoundationDemandInput): PartialContactResult {
    const { N_star_kN, M_star_kNm, width_mm, thickness_mm, q_allowable_kPa } = input;
    const checks: CheckResult[] = [];
    const steps: CalculationStep[] = [];

    // Convert width to meters for kPa calculation
    const width_m = UnitConverter.mmToM(width_mm);
    const thickness_m = UnitConverter.mmToM(thickness_mm);
    const Area_m2 = width_m * thickness_m;
    const SectionModulus_m3 = (width_m * Math.pow(thickness_m, 2)) / 6;

    // 1. Calculate Eccentricity
    // If N_star is very small or tension, eccentricity is conceptually infinite.
    // We handle pure tension or zero axial separately, but for slender walls, N_star is usually > 0.
    const e_m = Math.abs(N_star_kN) > 1e-6 ? Math.abs(M_star_kNm) / Math.abs(N_star_kN) : 999;
    const e_mm = UnitConverter.mToMm(e_m);
    const e_kern_mm = thickness_mm / 6;

    let contactWidth_mm = 0;
    let q_max_kPa = 0;
    let q_min_kPa = 0;
    let isPartialContact = false;
    let T_star_kN = 0; // Hold-down tension demand

    if (e_mm <= e_kern_mm) {
      // FULL CONTACT: Trapezoidal stress distribution
      isPartialContact = false;
      contactWidth_mm = thickness_mm;
      
      const stress_N_m2 = N_star_kN / Area_m2;
      const stress_M_m2 = M_star_kNm / SectionModulus_m3;
      
      q_max_kPa = stress_N_m2 + stress_M_m2;
      q_min_kPa = Math.max(0, stress_N_m2 - stress_M_m2); // Cannot be negative in full contact model

      steps.push({
        id: 'found-full-contact',
        title: 'Foundation Bearing (Full Contact)',
        equation: 'q = N/A ± M/S',
        variables: {
          'e': `${e_mm.toFixed(1)} mm`,
          'e_kern': `${e_kern_mm.toFixed(1)} mm`,
          'N/A': `${stress_N_m2.toFixed(2)} kPa`,
          'M/S': `${stress_M_m2.toFixed(2)} kPa`
        },
        result: `q_max: ${q_max_kPa.toFixed(2)} kPa`,
        units: 'kPa',
        source: [NZS3101_FOUNDATION]
      });

    } else {
      // PARTIAL CONTACT: Triangular stress distribution
      isPartialContact = true;
      q_min_kPa = 0;

      // Derivation for triangular stress:
      // The resultant of the triangular compression block must align with the applied load N_star.
      // Distance from the compressed edge to the centroid of the triangle is x / 3.
      // Distance from the panel center to the compressed edge is thickness / 2.
      // Therefore, eccentricity e = (thickness / 2) - (x / 3).
      // Solving for x (contact width): x = 3 * (thickness / 2 - e)
      
      const x_m = 3 * ((thickness_m / 2) - e_m);
      contactWidth_mm = UnitConverter.mToMm(x_m);

      // Force equilibrium: N_star = 0.5 * q_max * x * width
      // Solving for q_max: q_max = (2 * N_star) / (x * width)
      if (x_m > 0) {
        q_max_kPa = (2 * N_star_kN) / (x_m * width_m);
      } else {
        q_max_kPa = 999999; // Edge case: load exactly at the edge, infinite stress
      }

      // Hold-down tension demand (T_star):
      // If the panel is rocking, the tension side dowels must resist the overturning moment 
      // not balanced by the self-weight/axial load.
      // Taking moments about the compression resultant (at distance x/3 from compressed edge):
      // T_star * d_t + N_star * (thickness/2 - x/3) = M_star
      // Since (thickness/2 - x/3) is exactly 'e', this simplifies to:
      // T_star * d_t = M_star - N_star * e
      // But M_star = N_star * e, so this implies T_star = 0 if we only consider global equilibrium 
      // of the rigid body. 
      // HOWEVER, in design, T_star is the force required to keep the panel attached if we assume 
      // the compression block is the ONLY thing resisting. Actually, the standard approach for 
      // base plate/wall uplift is: T_star = (M_star / lever_arm) - N_star_component.
      // Let's use a conservative lever arm = thickness - cover (approx 0.85 * thickness).
      const lever_arm_m = thickness_m * 0.85; 
      T_star_kN = Math.max(0, (M_star_kNm / lever_arm_m) - (N_star_kN * (thickness_m / 2 - x_m / 3) / lever_arm_m));
      // Simplified conservative uplift demand: T_star = (M_star / (0.85 * t)) - N_star * (some factor). 
      // A more precise method: T_star = (M_star - N_star * (t/2 - x/3)) / (t - cover - x/3).
      const d_t_m = thickness_m - 0.03 - (x_m / 3); // assuming 30mm cover
      T_star_kN = Math.max(0, (M_star_kNm - N_star_kN * (thickness_m / 2 - x_m / 3)) / d_t_m);

      steps.push({
        id: 'found-partial-contact',
        title: 'Foundation Bearing (Partial Contact)',
        equation: 'x = 3 × (t/2 - e); q_max = 2N / (x × b)',
        variables: {
          'e': `${e_mm.toFixed(1)} mm`,
          'e_kern': `${e_kern_mm.toFixed(1)} mm`,
          'x (contact width)': `${contactWidth_mm.toFixed(1)} mm`,
          'd_t (tension lever arm)': `${(d_t_m * 1000).toFixed(1)} mm`
        },
        result: `q_max: ${q_max_kPa.toFixed(2)} kPa, T_star: ${T_star_kN.toFixed(2)} kN`,
        units: 'kPa',
        source: [NZS3101_FOUNDATION]
      });
    }

    // 2. Bearing Capacity Check
    const bearingCheck: CheckResult = {
      id: 'found-bearing',
      title: 'Geotechnical Bearing Capacity',
      demand: q_max_kPa,
      capacity: q_allowable_kPa,
      utilisation: q_max_kPa / q_allowable_kPa,
      status: q_max_kPa <= q_allowable_kPa ? 'PASS' : 'FAIL',
      units: 'kPa',
      source: [NZS3101_FOUNDATION],
      governing: true
    };
    checks.push(bearingCheck);

    // 3. Uplift / Contact Check Warning
    if (isPartialContact) {
      checks.push({
        id: 'found-uplift-warning',
        title: 'Base Uplift / Partial Contact',
        demand: T_star_kN,
        capacity: 0, // Capacity checked separately in Connection Engine
        utilisation: T_star_kN > 0 ? 1.0 : 0,
        status: T_star_kN > 0 ? 'WARNING' : 'PASS',
        units: 'kN',
        source: [NZS3101_FOUNDATION],
        governing: false
      });
    }

    return {
      isPartialContact,
      eccentricity_mm: e_mm,
      contactWidth_mm,
      q_max_kPa,
      q_min_kPa,
      T_star_kN,
      checks,
      steps
    };
  }
}