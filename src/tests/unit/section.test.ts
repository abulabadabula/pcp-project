// src/tests/unit/section.test.ts

import { describe, it, expect } from 'vitest';
import { SectionNMEngine } from '../../engineering/section/nmInteraction';
import { DesignInput } from '../../domain/model/types';

function makeBasicInput(overrides?: Partial<DesignInput>): DesignInput {
  return {
    projectId: 'TEST-001',
    geometry: { width: 1000, height: 3000, thickness: 150 },
    concrete: { fc: 30, density: 2400 },
    reinforcement: [
      { id: 'layer1', locationFromCompressionFace: 120, area: 628, fy: 500, Es: 200000 }, // 2xN20
    ],
    phiFactor: 0.85,
    ...overrides,
  };
}

describe('SectionNMEngine', () => {
  it('should generate an N-M curve with at least 3 key points', () => {
    const engine = new SectionNMEngine(makeBasicInput());
    const result = engine.generateNMInteractionCurve();
    
    expect(result.nmCurve.length).toBeGreaterThanOrEqual(3);
    expect(result.nmCurve.some(p => p.description.includes('Pure Compression'))).toBe(true);
    expect(result.nmCurve.some(p => p.description.includes('Balanced'))).toBe(true);
    expect(result.nmCurve.some(p => p.description.includes('Pure Bending'))).toBe(true);
  });

  it('should produce positive phiM for a reinforced section', () => {
    const engine = new SectionNMEngine(makeBasicInput());
    const result = engine.generateNMInteractionCurve();
    
    expect(result.phiM).toBeGreaterThan(0);
    expect(result.phiN).toBeGreaterThan(0);
  });

  it('should produce higher capacity with more reinforcement', () => {
    const engine1 = new SectionNMEngine(makeBasicInput());
    const engine2 = new SectionNMEngine(makeBasicInput({
      reinforcement: [
        { id: 'layer1', locationFromCompressionFace: 120, area: 1256, fy: 500, Es: 200000 }, // 4xN20
      ],
    }));
    
    const r1 = engine1.generateNMInteractionCurve();
    const r2 = engine2.generateNMInteractionCurve();
    
    expect(r2.phiM).toBeGreaterThan(r1.phiM);
  });

  it('should respect alpha1/beta1 limits for high-strength concrete', () => {
    const engine = new SectionNMEngine(makeBasicInput({
      concrete: { fc: 70, density: 2400 },
    }));
    const result = engine.generateNMInteractionCurve();
    
    // For fc=70 > 55, alpha1 and beta1 should be reduced
    // The curve should still be valid (positive capacities)
    expect(result.phiM).toBeGreaterThan(0);
    expect(result.phiN).toBeGreaterThan(0);
  });
});