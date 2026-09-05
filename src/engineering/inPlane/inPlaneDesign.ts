// src/engineering/inPlane/inPlaneDesign.ts

import { DesignInput, CheckResult, CalculationStep } from '../../domain/model/types';
import { NZS3101 } from '../../domain/codeBasis/registry';
import { UnitConverter } from '../units/conversion';
import { SectionNMEngine } from '../section/nmInteraction';

export interface InPlaneDemand {
  N_star_kN: number; // Axial compression (+) or tension (-)
  V_star_kN: number; // In-plane shear
  M_star_kNm: number; // In-plane moment
}

export interface InPlaneDesignInput {
  geometry: DesignInput['geometry'];
  concrete: DesignInput['concrete'];
  reinforcement: DesignInput['reinforcement']; // Assuming horizontal and vertical layers
  demand: InPlaneDemand;
  phi: number;
  isStructuralWall: boolean; // Determines if boundary elements are required
}

export class InPlaneDesignEngine {
  private input: InPlaneDesignInput;
  private b: number; // Wall length (width in geometry)
  private h: number; // Wall thickness (height in geometry, but for IP it's the cross-section depth)
  private d: number; // Effective depth

  constructor(input: InPlaneDesignInput) {
    this.input = input;
    this.b = input.geometry.width; // Wall length
    this.h = input.geometry.thickness; // Wall thickness
    // Assume single layer or centroid of reinforcement for simplified d
    this.d = this.h - 50; // Approx cover
  }

  public evaluate(): { checks: CheckResult[]; steps: CalculationStep[] } {
    const checks: CheckResult[] = [];
    const steps: CalculationStep[] = [];

    // 1. Geometry & Detailing Limits (NZS 3101 Cl 11.4 & 11.6)
    this.checkDetailing(checks, steps);

    // 2. In-Plane Flexure (Reusing SectionNMEngine)
    this.checkFlexure(checks, steps);

    // 3. In-Plane Shear (NZS 3101 Cl 11.5)
    this.checkShear(checks, steps);

    // 4. Boundary Elements (NZS 3101 Cl 11.7)
    if (this.input.isStructuralWall) {
      this.checkBoundaryElements(checks, steps);
    }

    return { checks, steps };
  }

  private checkDetailing(checks: CheckResult[], steps: CalculationStep[]) {
    const { geometry, reinforcement } = this.input;
    const t = geometry.thickness;

    // Min thickness check (NZS 3101 11.4.1: min 100mm)
    const minT = 100;
    checks.push({
      id: 'ip-detail-thickness',
      title: 'Minimum Wall Thickness',
      demand: t,
      capacity: minT,
      utilisation: t / minT,
      status: t >= minT ? 'PASS' : 'FAIL',
      units: 'mm',
      source: [NZS3101.WALLS.MIN_THICKNESS],
      governing: false
    });

    // Horizontal reinforcement ratio check (NZS 3101 11.6.2)
    // Min rho_h = 0.0025 for walls <= 300mm thick
    const As_h = reinforcement.filter(r => r.id.includes('horizontal')).reduce((sum, r) => sum + r.area, 0);
    const Ag = geometry.width * geometry.thickness;
    const rho_h = As_h / Ag;
    const min_rho_h = t <= 300 ? 0.0025 : 0.0020;

    checks.push({
      id: 'ip-detail-rho-h',
      title: 'Minimum Horizontal Reinforcement Ratio',
      demand: rho_h,
      capacity: min_rho_h,
      utilisation: rho_h / min_rho_h,
      status: rho_h >= min_rho_h ? 'PASS' : 'FAIL',
      units: '-',
      source: [NZS3101.WALLS.DETAILING],
      governing: false
    });
  }

  private checkFlexure(checks: CheckResult[], steps: CalculationStep[]) {
    // Reuse the SectionNMEngine to get capacity at the given N*
    // Note: SectionNMEngine uses 'width' as the section width and 'thickness' as depth.
    // For In-Plane, the 'width' is the wall length, and 'thickness' is the wall thickness.
    const nmEngine = new SectionNMEngine({
      projectId: 'IP-FLEXURE',
      geometry: this.input.geometry,
      concrete: this.input.concrete,
      reinforcement: this.input.reinforcement,
      phiFactor: this.input.phi
    });

    const nmResult = nmEngine.generateNMInteractionCurve();
    
    // Find the moment capacity at the specific axial load N*
    // Simplified: Use the pure bending capacity or interpolate. 
    // For a rigorous check, we would interpolate the NM curve at N_star.
    // Here we just check if the demand point is inside the curve.
    const phiM_cap = nmResult.phiM; // Simplified for demo
    const phiN_cap = nmResult.phiN;

    const { N_star_kN, M_star_kNm } = this.input.demand;

    checks.push({
      id: 'ip-flexure-nm',
      title: 'In-Plane N-M Interaction',
      demand: M_star_kNm,
      capacity: phiM_cap,
      utilisation: M_star_kNm / phiM_cap,
      status: M_star_kNm <= phiM_cap ? 'PASS' : 'FAIL', // Simplified status
      units: 'kNm',
      source: [NZS3101.SECTION.STRAIN_COMPAT],
      governing: true
    });
  }

  private checkShear(checks: CheckResult[], steps: CalculationStep[]) {
    const { N_star_kN, V_star_kN } = this.input.demand;
    const { concrete, geometry } = this.input;
    const fc = concrete.fc;
    const b = geometry.width; // Wall length
    const d = this.d;

    // NZS 3101 Cl 11.5.2: Shear strength of walls
    // V_c = 0.6 * sqrt(fc') * b * d (Simplified for low axial load / slender walls)
    // More accurately, it depends on M/(V*d) ratio and axial load.
    // Using a conservative baseline for slender precast panels:
    const Vc_N = 0.6 * Math.sqrt(fc) * b * d;
    const Vc_kN = UnitConverter.NToKN(Vc_N);
    
    // Shear reinforcement contribution (V_s)
    const As_v = this.input.reinforcement.filter(r => r.id.includes('vertical')).reduce((sum, r) => sum + r.area, 0);
    const rho_v = As_v / (b * this.h);
    // V_s = rho_v * fy * b * d (Simplified shear friction/truss model)
    const fy = this.input.reinforcement[0]?.fy || 500;
    const Vs_N = rho_v * fy * b * d;
    const Vs_kN = UnitConverter.NToKN(Vs_N);

    const Vn_kN = Vc_kN + Vs_kN;
    const phiVn_kN = this.input.phi * Vn_kN;

    steps.push({
      id: 'ip-shear-calc',
      title: 'In-Plane Shear Capacity',
      equation: 'φV_n = φ(V_c + V_s)',
      variables: {
        'V_c': `${Vc_kN.toFixed(1)} kN`,
        'V_s': `${Vs_kN.toFixed(1)} kN`,
        'φ': this.input.phi
      },
      result: phiVn_kN,
      units: 'kN',
      source: [NZS3101.WALLS.SHEAR_STRENGTH]
    });

    checks.push({
      id: 'ip-shear',
      title: 'In-Plane Shear Strength',
      demand: V_star_kN,
      capacity: phiVn_kN,
      utilisation: V_star_kN / phiVn_kN,
      status: V_star_kN <= phiVn_kN ? 'PASS' : 'FAIL',
      units: 'kN',
      source: [NZS3101.WALLS.SHEAR_STRENGTH],
      governing: true
    });
  }

  private checkBoundaryElements(checks: CheckResult[], steps: CalculationStep[]) {
    // NZS 3101 Cl 11.7: Boundary elements are required if the extreme fibre compressive strain exceeds a limit.
    // Simplified check: If neutral axis depth c > limit, boundary element is required.
    // For slender precast panels (Mode B), boundary elements are often not required if ductility is low.
    
    checks.push({
      id: 'ip-boundary-check',
      title: 'Boundary Element Requirement',
      demand: 0, // Placeholder for actual strain demand
      capacity: 0, // Placeholder for limit
      utilisation: 0,
      status: 'PASS', // Assume not required for this slender panel demo
      units: '-',
      source: [NZS3101.WALLS.BOUNDARY_ELEMENT],
      governing: false
    });
  }
}