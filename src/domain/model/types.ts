// src/domain/model/types.ts

export interface CodeReference {
  id: string;
  standard: string;
  edition: string;
  clause?: string;
  table?: string;
  equation?: string;
  description: string;
}

export interface PanelGeometry {
  width: number;       // mm
  height: number;      // mm
  thickness: number;   // mm
}

export interface ConcreteMaterial {
  fc: number;          // MPa (N/mm²)
  density: number;     // kg/m³
  Ec?: number;         // MPa, optional, can be calculated
}

export interface ReinforcementLayer {
  id: string;
  locationFromCompressionFace: number; // mm
  area: number;                        // mm² (total area of this layer)
  fy: number;                          // MPa
  Es: number;                          // MPa (typically 200000)
}

export interface DesignInput {
  projectId: string;
  geometry: PanelGeometry;
  concrete: ConcreteMaterial;
  reinforcement: ReinforcementLayer[];
  phiFactor: number; // Capacity reduction factor (e.g., 0.85 per NZS 3101)
}

export interface CalculationStep {
  id: string;
  title: string;
  equation?: string;
  variables: Record<string, number | string>;
  result: number | string;
  units: string;
  source: CodeReference[];
}

export interface CheckResult {
  id: string;
  title: string;
  demand: number;
  capacity: number;
  utilisation: number; // demand / capacity
  status: 'PASS' | 'WARNING' | 'FAIL' | 'NOT_CHECKED';
  units: string;
  source: CodeReference[];
  governing: boolean;
}

export interface NMInteractionPoint {
  N: number; // kN
  M: number; // kNm
  c: number; // mm, neutral axis depth
  description: string;
}

export interface SectionCapacityResult {
  steps: CalculationStep[];
  checks: CheckResult[];
  nmCurve: NMInteractionPoint[];
  phiN: number; // kN
  phiM: number; // kNm
}
export interface Warning { id: string; title: string; message: string; source?: CodeReference; }
