// src/application/runDesign.ts

import { DesignInput, SectionCapacityResult } from '../domain/model/types';
import { SectionNMEngine } from '../engineering/section/nmInteraction';

export function runPrecastPanelDesign(input: DesignInput): {
  sectionResults: SectionCapacityResult;
  // future: oopResults, connectionResults, etc.
} {
  // 1. Validate Input (Placeholder for Prompt 02 validation)
  if (input.geometry.thickness < 100) {
    throw new Error("Wall thickness below minimum code limit (100mm)");
  }

  // 2. Execute Calculation Engines
  const nmEngine = new SectionNMEngine(input);
  const sectionResults = nmEngine.generateNMInteractionCurve();

  // 3. Return structured, traceable result model
  return {
    sectionResults
  };
}