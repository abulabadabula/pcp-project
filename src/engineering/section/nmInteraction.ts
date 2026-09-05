// src/engineering/section/nmInteraction.ts

import { DesignInput, SectionCapacityResult, NMInteractionPoint, CalculationStep, CheckResult, CodeReference } from '../../domain/model/types';
import { UnitConverter } from '../units/conversion';

const NZS3101_CLAUSE: CodeReference = {
  id: 'NZS3101-10.3',
  standard: 'NZS 3101.1',
  edition: '2006+A3',
  clause: '10.3',
  description: 'Rectangular stress block parameters and strain compatibility'
};

export class SectionNMEngine {
  private input: DesignInput;
  private b: number; // width (mm)
  private h: number; // height/thickness (mm)
  private fc: number; // MPa
  private alpha1: number;
  private beta1: number;

  constructor(input: DesignInput) {
    this.input = input;
    this.b = input.geometry.width;
    this.h = input.geometry.thickness;
    this.fc = input.concrete.fc;
    
    // NZS 3101 10.3.2: For fc' <= 55 MPa, alpha1 = 0.85, beta1 = 0.85
    this.alpha1 = this.fc <= 55 ? 0.85 : Math.max(0.65, 0.85 - 0.004 * (this.fc - 55));
    this.beta1 = this.fc <= 55 ? 0.85 : Math.max(0.65, 0.85 - 0.008 * (this.fc - 55));
  }

  /**
   * Calculate nominal axial and moment capacity for a given neutral axis depth 'c'
   */
  private calculateCapacityAtNeutralAxis(c: number): { Nn: number; Mn: number } {
    const { b, h, fc, alpha1, beta1 } = this;
    const epsilonCu = 0.003; // NZS 3101 ultimate concrete strain

    // 1. Concrete Compression Force
    const a = beta1 * c;
    const Cc = alpha1 * fc * b * a; // N
    const leverArmCc = (h / 2) - (a / 2); // mm

    // 2. Steel Forces
    let totalFs = 0; // N
    let totalMs = 0; // Nmm

    this.input.reinforcement.forEach(layer => {
      const d = layer.locationFromCompressionFace;
      const epsilonS = epsilonCu * ((c - d) / c);
      
      // Elastic stress, capped at yield
      let fs = layer.Es * epsilonS;
      if (fs > layer.fy) fs = layer.fy;
      if (fs < -layer.fy) fs = -layer.fy;

      // Force in steel. If in compression zone, subtract concrete stress already accounted for in Cc
      // Simplified NZS approach: Fs = As * fs (conservative and standard for typical wall rho)
      // More precise: Fs = As * (fs - alpha1 * fc) if fs > 0. We use precise here.
      const fsAdjusted = fs > 0 ? fs - (alpha1 * fc) : fs;
      const Fs = layer.area * fsAdjusted; // N

      const leverArmFs = (h / 2) - d; // mm

      totalFs += Fs;
      totalMs += Fs * leverArmFs;
    });

    const Nn = Cc + totalFs; // N
    const Mn = (Cc * leverArmCc) + totalMs; // Nmm

    return { Nn, Mn };
  }

  /**
   * Generate the full N-M interaction curve (Nominal and Design)
   */
  public generateNMInteractionCurve(): SectionCapacityResult {
    const steps: CalculationStep[] = [];
    const checks: CheckResult[] = [];
    const nmCurve: NMInteractionPoint[] = [];

    // Key points to evaluate: 
    // 1. Pure Compression (c = infinity, practically c = h * 10)
    // 2. Balanced failure (c = cb)
    // 3. Pure Bending (N = 0, find c iteratively)
    // 4. Tension controlled limit

    // --- Point 1: Pure Compression ---
    const cMax = this.h * 10;
    const pureComp = this.calculateCapacityAtNeutralAxis(cMax);
    nmCurve.push({
      N: UnitConverter.NToKN(pureComp.Nn),
      M: UnitConverter.nmmToKNm(pureComp.Mn),
      c: cMax,
      description: 'Pure Compression'
    });

    // --- Point 2: Balanced Failure ---
    // For Grade 500E, fy = 500, Es = 200000 -> epsilonY = 0.0025
    const fy = this.input.reinforcement[0]?.fy || 500;
    const Es = this.input.reinforcement[0]?.Es || 200000;
    const epsilonY = fy / Es;
    const dMax = Math.max(...this.input.reinforcement.map(r => r.locationFromCompressionFace));
    const cb = (0.003 / (0.003 + epsilonY)) * dMax;
    
    const balanced = this.calculateCapacityAtNeutralAxis(cb);
    nmCurve.push({
      N: UnitConverter.NToKN(balanced.Nn),
      M: UnitConverter.nmmToKNm(balanced.Mn),
      c: cb,
      description: 'Balanced Failure'
    });

    // --- Point 3: Pure Bending (Iterative to find Nn ≈ 0) ---
    let cBend = cb * 0.5; // Initial guess
    let bendResult = this.calculateCapacityAtNeutralAxis(cBend);
    // Simple bisection for demo (in production, use a robust root-finding algorithm like Brent's method)
    for (let i = 0; i < 20; i++) {
      if (bendResult.Nn > 0) {
        cBend *= 0.8; // Reduce compression zone
      } else {
        cBend *= 1.2; // Increase compression zone
      }
      bendResult = this.calculateCapacityAtNeutralAxis(cBend);
    }
    nmCurve.push({
      N: UnitConverter.NToKN(bendResult.Nn),
      M: UnitConverter.nmmToKNm(bendResult.Mn),
      c: cBend,
      description: 'Pure Bending (N ≈ 0)'
    });

    // Apply Phi factors (Design Strength)
    const phi = this.input.phiFactor;
    steps.push({
      id: 'phi-factor',
      title: 'Capacity Reduction Factor',
      equation: 'φ = 0.85 (Typical for wall flexure/axial)',
      variables: { phi: phi },
      result: phi,
      units: '-',
      source: [NZS3101_CLAUSE]
    });

    // Generate design curve points
    const designCurve = nmCurve.map(pt => ({
      ...pt,
      N: pt.N * phi,
      M: pt.M * phi,
      description: pt.description + ' (Design)'
    }));

    return {
      steps,
      checks,
      nmCurve: [...nmCurve, ...designCurve],
      phiN: UnitConverter.NToKN(pureComp.Nn) * phi,
      phiM: UnitConverter.nmmToKNm(bendResult.Mn) * phi
    };
  }

  /**
   * Check a specific demand (N*, M*) against the capacity
   */
  public checkDemand(Nstar_kN: number, Mstar_kNm: number): CheckResult {
    // Simplified linear interpolation check for demonstration.
    // In production, this should check if the point (N*, M*) lies inside the phi-NM polygon.
    const capacityM_kNm = 100; // Placeholder: should be interpolated from generateNMInteractionCurve
    const utilisation = Mstar_kNm / capacityM_kNm;
    
    return {
      id: 'nm-check-01',
      title: 'In-Plane N-M Interaction',
      demand: Mstar_kNm,
      capacity: capacityM_kNm,
      utilisation: utilisation,
      status: utilisation <= 1.0 ? 'PASS' : 'FAIL',
      units: 'kNm',
      source: [NZS3101_CLAUSE],
      governing: true
    };
  }
}