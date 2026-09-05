// src/engineering/actions/combinations.ts

import { ActionCase, SectionDemand, CodeReference } from '../../domain/model/types';
import { UnitConverter } from '../units/conversion';

const AS1170_0_CLAUSE: CodeReference = {
  id: 'AS1170.0-3.2',
  standard: 'AS/NZS 1170.0',
  edition: '2002',
  clause: '3.2',
  description: 'Limit state design combinations'
};

const NZS1170_5_PARTS: CodeReference = {
  id: 'NZS1170.5-8.3',
  standard: 'NZS 1170.5',
  edition: '2004',
  clause: '8.3',
  description: 'Design of parts and components'
};

export interface LoadCombinationRule {
  id: string;
  description: string;
  factors: { G: number; Q: number; W: number; E: number };
  isULS: boolean;
  source: CodeReference;
}

export const STANDARD_COMBINATIONS: LoadCombinationRule[] = [
  {
    id: 'ULS_1',
    description: '1.2G + 1.5Q',
    factors: { G: 1.2, Q: 1.5, W: 0.0, E: 0.0 },
    isULS: true,
    source: AS1170_0_CLAUSE
  },
  {
    id: 'ULS_E_Pos',
    description: '1.0G + E_u + 0.3Q',
    factors: { G: 1.0, Q: 0.3, W: 0.0, E: 1.0 },
    isULS: true,
    source: AS1170_0_CLAUSE
  },
  {
    id: 'ULS_E_Neg',
    description: '0.9G + E_u',
    factors: { G: 0.9, Q: 0.0, W: 0.0, E: 1.0 },
    isULS: true,
    source: AS1170_0_CLAUSE
  },
  {
    id: 'SLS_Frequent',
    description: 'G + 0.4Q',
    factors: { G: 1.0, Q: 0.4, W: 0.0, E: 0.0 },
    isULS: false,
    source: AS1170_0_CLAUSE
  }
];

export interface SeismicPartActionInput {
  Wp_kN: number;          // Panel weight
  C_p_Tp: number;         // Part spectral coefficient
  C_ph: number;           // Part height coefficient
  R_p: number;            // Part response factor
  Z: number;              // Hazard factor
  Sp: number;             // Structural performance factor
}

export class ActionEngine {
  /**
   * Calculate seismic part action (F_p) per NZS 1170.5 Clause 8.3
   * F_p = C_p(T_p) * C_ph * R_p * Z * W_p
   * Note: This is the horizontal force acting on the panel.
   */
  public static calculateSeismicPartAction(input: SeismicPartActionInput): { Fp_kN: number; step: any } {
    const { Wp_kN, C_p_Tp, C_ph, R_p, Z, Sp } = input;
    
    // NZS 1170.5 Eq 8.3(1): F_p = C_p(T_p) * C_ph * R_p * Z * W_p
    // Note: Sp is used to calculate C_p(T_p) in some contexts, but here we assume C_p_Tp is already derived or Sp is applied as a multiplier per specific interpretation.
    // Standard formula: F_p = C_p(T_p) * C_ph * R_p * Z * W_p
    
    const Fp_kN = C_p_Tp * C_ph * R_p * Z * Wp_kN;

    return {
      Fp_kN,
      step: {
        id: 'seismic-part-action',
        title: 'Seismic Part Action (Fp)',
        equation: 'F_p = C_p(T_p) × C_ph × R_p × Z × W_p',
        variables: {
          'C_p(T_p)': C_p_Tp,
          'C_ph': C_ph,
          'R_p': R_p,
          'Z': Z,
          'W_p': `${Wp_kN} kN`
        },
        result: Fp_kN,
        units: 'kN',
        source: [NZS1170_5_PARTS]
      }
    };
  }

  /**
   * Generate section demands for all defined load combinations
   */
  public static generateDemands(
    cases: Record<string, { N_kN: number; M_kNm: number; V_kN: number; w_kPa: number }>,
    combinations: LoadCombinationRule[]
  ): SectionDemand[] {
    return combinations.map(comb => {
      const f = comb.factors;
      
      // Superposition of actions
      const N_star = (f.G * (cases.G?.N_kN || 0)) + (f.Q * (cases.Q?.N_kN || 0)) + (f.E * (cases.E?.N_kN || 0));
      const M_star = (f.G * (cases.G?.M_kNm || 0)) + (f.Q * (cases.Q?.M_kNm || 0)) + (f.E * (cases.E?.M_kNm || 0)) + (f.W * (cases.W?.M_kNm || 0));
      const V_star = (f.G * (cases.G?.V_kN || 0)) + (f.Q * (cases.Q?.V_kN || 0)) + (f.E * (cases.E?.V_kN || 0)) + (f.W * (cases.W?.V_kN || 0));
      const w_star = (f.G * (cases.G?.w_kPa || 0)) + (f.Q * (cases.Q?.w_kPa || 0)) + (f.E * (cases.E?.w_kPa || 0)) + (f.W * (cases.W?.w_kPa || 0));

      return {
        Nstar: N_star,
        Mstar: M_star,
        Vstar: V_star,
        w_star: w_star, // Face load for OOP
        combinationId: comb.id,
        isULS: comb.isULS,
        description: comb.description,
        source: comb.source
      };
    });
  }
}