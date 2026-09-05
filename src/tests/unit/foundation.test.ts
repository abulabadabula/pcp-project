// src/tests/unit/foundation.test.ts

import { describe, it, expect } from 'vitest';
import { FoundationInterfaceEngine, FoundationDemandInput } from '../../engineering/foundation/partialContact';

describe('FoundationInterfaceEngine', () => {
  const baseInput: FoundationDemandInput = {
    N_star_kN: 100,
    M_star_kNm: 10,
    width_mm: 1000,
    thickness_mm: 150,
    q_allowable_kPa: 300,
  };

  it('should detect full contact when e < t/6', () => {
    const engine = new FoundationInterfaceEngine();
    // e = M/N = 10/100 = 0.1m = 100mm; t/6 = 150/6 = 25mm
    // Actually 100 > 25, so this IS partial contact. Let me fix the input.
    const result = engine.analyze({ ...baseInput, M_star_kNm: 2 });
    // e = 2/100 = 0.02m = 20mm < 25mm -> full contact
    expect(result.isPartialContact).toBe(false);
    expect(result.q_min_kPa).toBeGreaterThanOrEqual(0);
    expect(result.contactWidth_mm).toBe(150);
  });

  it('should detect partial contact when e > t/6', () => {
    const engine = new FoundationInterfaceEngine();
    const result = engine.analyze(baseInput);
    // e = 10/100 = 0.1m = 100mm > 25mm -> partial contact
    expect(result.isPartialContact).toBe(true);
    expect(result.q_min_kPa).toBe(0);
    expect(result.contactWidth_mm).toBeLessThan(150);
    expect(result.contactWidth_mm).toBeGreaterThan(0);
  });

  it('should calculate triangular q_max correctly for partial contact', () => {
    const engine = new FoundationInterfaceEngine();
    const result = engine.analyze(baseInput);
    
    // x = 3 * (t/2 - e) = 3 * (0.075 - 0.1) = negative! 
    // This means the resultant is outside the section -> extreme case
    // Let's use a more moderate case:
    const moderate = engine.analyze({ ...baseInput, M_star_kNm: 5 });
    // e = 5/100 = 0.05m = 50mm; x = 3*(75-50) = 75mm
    expect(moderate.isPartialContact).toBe(true);
    expect(moderate.contactWidth_mm).toBeCloseTo(75, 0);
    // q_max = 2N/(x*b) = 2*100/(0.075*1.0) = 2666.7 kPa
    expect(moderate.q_max_kPa).toBeCloseTo(2666.7, 0);
  });

  it('should calculate uplift tension demand T_star', () => {
    const engine = new FoundationInterfaceEngine();
    const result = engine.analyze({ ...baseInput, M_star_kNm: 5 });
    
    expect(result.T_star_kN).toBeGreaterThan(0);
  });

  it('should FAIL bearing check when q_max > q_allowable', () => {
    const engine = new FoundationInterfaceEngine();
    const result = engine.analyze(baseInput);
    
    const bearingCheck = result.checks.find(c => c.id === 'found-bearing');
    expect(bearingCheck).toBeDefined();
    // With e=100mm > t/2=75mm, this is an extreme case, q_max will be very high
    expect(bearingCheck!.status).toBe('FAIL');
  });
});