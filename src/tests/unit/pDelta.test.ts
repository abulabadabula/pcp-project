// src/tests/unit/pDelta.test.ts

import { describe, it, expect } from 'vitest';
import { PDeltaEngine, PDeltaInput } from '../../engineering/outOfPlane/pDelta';

describe('PDeltaEngine', () => {
  const baseInput: PDeltaInput = {
    L_mm: 3000,
    N_star_kN: 50,
    w_star_kPa: 2.0, // 2 kN/m line load on 1m strip
    EI_eff_Nmm2: 5.0e12, // ~5 × 10^12 N·mm² (typical for 150mm wall)
    supportCondition: 'pinned-pinned',
    maxIterations: 50,
    tolerance_mm: 0.01,
  };

  it('should converge for a stable panel', () => {
    const engine = new PDeltaEngine();
    const result = engine.solve(baseInput);
    
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(50);
    expect(result.M_final_kNm).toBeGreaterThan(result.M0_kNm); // P-Delta adds moment
    expect(result.delta_max_mm).toBeGreaterThan(0);
  });

  it('should report non-convergence for near-buckling load', () => {
    const engine = new PDeltaEngine();
    const result = engine.solve({
      ...baseInput,
      N_star_kN: 5000, // Extremely high axial load -> should not converge or amplify massively
      maxIterations: 20,
    });
    
    // Either it doesn't converge, or the final moment is massively amplified
    const isUnstable = !result.converged || result.M_final_kNm > result.M0_kNm * 10;
    expect(isUnstable).toBe(true);
  });

  it('should produce zero P-Delta moment when N=0', () => {
    const engine = new PDeltaEngine();
    const result = engine.solve({ ...baseInput, N_star_kN: 0 });
    
    expect(result.converged).toBe(true);
    expect(Math.abs(result.M_final_kNm - result.M0_kNm)).toBeLessThan(0.001);
  });
});