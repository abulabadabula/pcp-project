// src/tests/benchmarks/branz-example-01.test.ts

import { describe, it, expect } from 'vitest';
import { BranzStabilityEngine, BranzStabilityInput } from '../../engineering/outOfPlane/branzStability';

/**
 * Benchmark based on BRANZ 2007 Example Calculation parameters.
 * 
 * Panel: 150mm thick, 3000mm high, 30MPa concrete, Grade 500E rebar
 * Low axial load scenario per BRANZ scope.
 * 
 * Expected: PASS for scope checks, PASS for stability.
 */
describe('BRANZ 2007 Benchmark — Example 01', () => {
  const input: BranzStabilityInput = {
    H_mm: 3000,
    t_mm: 150,
    N_star_kN: 20,       // Low axial load
    N_cr_kN: 350,        // Euler critical load (pre-calculated)
    phi: 0.85,
    rho: 0.42,           // ~0.42% reinforcement ratio
    fy_MPa: 500,
    fc_MPa: 30,
  };

  it('should pass BRANZ scope H/t check', () => {
    const engine = new BranzStabilityEngine();
    const result = engine.checkScopeAndStability(input);
    
    const htCheck = result.checks.find(c => c.id === 'branz-scope-ht');
    expect(htCheck).toBeDefined();
    expect(htCheck!.status).toBe('PASS');
    expect(htCheck!.demand).toBe(20); // 3000/150 = 20
  });

  it('should pass BRANZ scope low-axial-load check', () => {
    const engine = new BranzStabilityEngine();
    const result = engine.checkScopeAndStability(input);
    
    const axialCheck = result.checks.find(c => c.id === 'branz-scope-axial');
    expect(axialCheck).toBeDefined();
    expect(axialCheck!.status).toBe('PASS');
  });

  it('should pass BRANZ Euler stability check', () => {
    const engine = new BranzStabilityEngine();
    const result = engine.checkScopeAndStability(input);
    
    const stabilityCheck = result.checks.find(c => c.id === 'branz-stability-euler');
    expect(stabilityCheck).toBeDefined();
    expect(stabilityCheck!.status).toBe('PASS');
    // Utilisation = 20 / (0.85 * 350) = 20 / 297.5 ≈ 0.067
    expect(stabilityCheck!.utilisation).toBeLessThan(0.1);
  });

  it('should flag OUT_OF_SCOPE for excessive H/t', () => {
    const engine = new BranzStabilityEngine();
    const result = engine.checkScopeAndStability({ ...input, H_mm: 5000, t_mm: 150 });
    
    const htCheck = result.checks.find(c => c.id === 'branz-scope-ht');
    expect(htCheck!.status).toBe('OUT_OF_SCOPE');
    expect(htCheck!.demand).toBeCloseTo(33.3, 1); // 5000/150
  });

  it('should FAIL stability when axial load exceeds phi*N_cr', () => {
    const engine = new BranzStabilityEngine();
    const result = engine.checkScopeAndStability({ ...input, N_star_kN: 310 });
    
    const stabilityCheck = result.checks.find(c => c.id === 'branz-stability-euler');
    expect(stabilityCheck!.status).toBe('FAIL');
    expect(stabilityCheck!.utilisation).toBeGreaterThan(1.0);
  });
});