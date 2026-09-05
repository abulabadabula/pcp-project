// src/engineering/connections/baseConnection.ts

import { DesignInput, CheckResult, CalculationStep, CodeReference } from '../../domain/model/types';
import { UnitConverter } from '../units/conversion';

const NZS3101_CL_17_5: CodeReference = {
  id: 'NZS3101-17.5',
  standard: 'NZS 3101.1',
  edition: '2006+A3',
  clause: '17.5',
  description: 'Shear friction and dowel action'
};

const NZS3101_CL_17_4: CodeReference = {
  id: 'NZS3101-17.4',
  standard: 'NZS 3101.1',
  edition: '2006+A3',
  clause: '17.4',
  description: 'Tension capacity of anchors/dowels'
};

export interface BaseConnectionInput {
  N_star_kN: number;       // Axial load at base (kN, compression positive)
  V_star_kN: number;       // Shear demand at base (kN)
  M_star_kNm: number;      // Moment demand at base (kNm)
  frictionCoeff: number;   // Coefficient of friction (e.g., 0.7 for rough concrete)
  dowels: {
    count: number;
    diameter_mm: number;
    fy_MPa: number;
    embedmentValid: boolean; // Has development length been checked?
  };
  shearKey: {
    enabled: boolean;
    width_mm: number;
    depth_mm: number;
    fc_MPa: number;
  };
  phi: number;             // Capacity reduction factor (e.g., 0.85)
}

export class BaseConnectionEngine {
  public evaluate(input: BaseConnectionInput): { checks: CheckResult[]; steps: CalculationStep[] } {
    const checks: CheckResult[] = [];
    const steps: CalculationStep[] = [];
    const { N_star_kN, V_star_kN, dowels, shearKey, frictionCoeff, phi } = input;

    // 1. Friction Capacity (Only effective if N_star is compression)
    let V_fric_kN = 0;
    if (N_star_kN > 0) {
      V_fric_kN = frictionCoeff * N_star_kN;
    }
    const phiV_fric_kN = phi * V_fric_kN;
    
    checks.push({
      id: 'conn-friction',
      title: 'Base Friction Capacity',
      demand: V_star_kN,
      capacity: phiV_fric_kN,
      utilisation: V_star_kN / (phiV_fric_kN || 1e-6), // Avoid div by zero
      status: V_star_kN <= phiV_fric_kN ? 'PASS' : 'FAIL',
      units: 'kN',
      source: [NZS3101_CL_17_5],
      governing: false
    });

    // 2. Shear Key Capacity (Simplified concrete bearing/shear model)
    let V_sk_kN = 0;
    if (shearKey.enabled) {
      // Simplified: V_sk = phi * 0.2 * fc' * Area_sk (Conservative bearing)
      // Or NZS 3101 shear key specific provisions. Using a generic conservative bearing for demo.
      const Area_sk_mm2 = shearKey.width_mm * shearKey.depth_mm;
      V_sk_kN = 0.2 * shearKey.fc_MPa * Area_sk_mm2 / 1000; // kN
    }
    const phiV_sk_kN = phi * V_sk_kN;

    if (shearKey.enabled) {
      checks.push({
        id: 'conn-shear-key',
        title: 'Shear Key Bearing Capacity',
        demand: V_star_kN, // Note: In reality, shear is shared between friction, shear key, and dowels. 
                           // A rigorous check distributes V_star or checks V_star <= sum(phi*V_i).
                           // Here we check individual contributions for transparency.
        capacity: phiV_sk_kN,
        utilisation: V_star_kN / (phiV_sk_kN || 1e-6),
        status: V_star_kN <= phiV_sk_kN ? 'PASS' : 'FAIL', // Simplified individual check
        units: 'kN',
        source: [NZS3101_CL_17_5],
        governing: false
      });
    }

    // 3. Dowel Shear Capacity (Dowel action / Shear friction)
    const As_dowel_mm2 = dowels.count * (Math.PI * Math.pow(dowels.diameter_mm, 2) / 4);
    // Simplified shear friction model: V_n = mu * As * fy (mu=1.4 for roughened with dowels)
    // Or dowel bearing. Using shear friction as baseline.
    const V_dowel_n_kN = 1.4 * As_dowel_mm2 * dowels.fy_MPa / 1000; 
    const phiV_dowel_kN = phi * V_dowel_n_kN;

    checks.push({
      id: 'conn-dowel-shear',
      title: 'Dowel Shear Capacity (Shear Friction)',
      demand: V_star_kN,
      capacity: phiV_dowel_kN,
      utilisation: V_star_kN / (phiV_dowel_kN || 1e-6),
      status: V_star_kN <= phiV_dowel_kN ? 'PASS' : 'FAIL',
      units: 'kN',
      source: [NZS3101_CL_17_5],
      governing: false
    });

    // 4. Dowel Tension Capacity (Steel yielding, concrete breakout to be added)
    const N_dowel_n_kN = As_dowel_mm2 * dowels.fy_MPa / 1000;
    const phiN_dowel_kN = phi * N_dowel_n_kN;

    steps.push({
      id: 'conn-dowel-tension-calc',
      title: 'Dowel Tension Capacity (Steel)',
      equation: 'φN_n = φ × A_s × f_y',
      variables: {
        'A_s': `${As_dowel_mm2.toFixed(1)} mm²`,
        'f_y': `${dowels.fy_MPa} MPa`,
        'φ': phi
      },
      result: phiN_dowel_kN,
      units: 'kN',
      source: [NZS3101_CL_17_4]
    });

    // Note: Actual tension demand (T_star) is calculated in the Foundation Interface module 
    // based on partial contact equilibrium, then passed here for checking.
    // For now, we return the capacity for the caller to use.

    return { checks, steps };
  }
}