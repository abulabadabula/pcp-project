# PCP — New Zealand Precast Concrete Panel Design Software
## Architecture, Calculation Engine Specification & AI Coding Prompts

**Target stack**
- Frontend: React 18
- UI: Material UI (MUI)
- Equations: KaTeX / `react-katex`
- Charts: Plotly.js or a small SVG chart component where print fidelity is important
- Language: JavaScript / TypeScript-compatible architecture; TypeScript is recommended for the new domain/calculation layer
- PDF/report: React print view + PDF generation/print workflow
- Testing: Vitest + React Testing Library
- Optional backend later: Python FastAPI for project persistence, batch calculation, audit/report generation and advanced analysis

**Engineering design basis**
- NZ Building Code B1 / applicable Verification Method / Acceptable Solution pathway
- AS/NZS 1170.0 — General principles
- AS/NZS 1170.1 — Permanent, imposed and other actions
- AS/NZS 1170.2:2021 — Wind actions
- NZS 1170.5:2004 — Earthquake actions, including requirements for parts/components
- NZS 3101.1&2:2006 with incorporated amendments, including A3
- BRANZ, G. J. Beattie (2007), *Slender Precast Concrete Panels with Low Axial Load*
- Other project-specific standards as explicitly selected by the engineer (e.g. steel/connections, durability, fire, geotechnical/foundation standards)

> **Important:** This document is a software architecture and engineering calculation specification. It is not a substitute for the cited standards or an engineering sign-off. The application must never silently replace a user-selected code edition with a newer draft or a different standard.

---

# 1. Executive recommendation

The current PCP repository is a useful prototype, but it should not be developed further by continuing to enlarge the existing calculation/UI files. The repository currently contains a very large `PrecastPanel.jsx`, a large `PrecastPanelCalculation-revised.js`, a large `PrecastPanelReport.jsx`, a configuration file and a dedicated N–M chart. The current calculation entry point already conceptually separates in-plane design, out-of-plane design, connection design, foundation design and a summary, but these are still implemented inside one monolithic calculation module and are strongly coupled to input names, UI expectations and report structures.

The recommended next generation architecture is:

```text
┌───────────────────────────────────────────────────────────────────┐
│ React 18 + Material UI                                             │
│                                                                   │
│  Project / Input / Analysis / Results / Calculation / Report UI   │
└──────────────────────────────┬────────────────────────────────────┘
                               │ typed DesignModel
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│ Application Layer                                                 │
│                                                                   │
│  validateDesignInput()                                            │
│  runPrecastPanelDesign()                                          │
│  buildReportModel()                                               │
│  compareDesignRevisions()                                         │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│ Pure Engineering Domain / Calculation Engine                      │
│                                                                   │
│  codeBasis/                                                       │
│  actions/                                                         │
│  materials/                                                       │
│  sections/                                                        │
│  inPlane/                                                         │
│  outOfPlane/                                                      │
│  stability/                                                       │
│  connections/                                                     │
│  foundation/                                                      │
│  serviceability/                                                  │
│  designCombinations/                                              │
│  reportingModel/                                                  │
└──────────────────────────────┬────────────────────────────────────┘
                               │ structured CalculationResult
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│ Traceability / QA layer                                           │
│                                                                   │
│  equation ID / clause / source / assumptions / warnings / tests  │
└───────────────────────────────────────────────────────────────────┘
```

The critical rule is:

> **JSX components may display calculations, but they may not own engineering formulas.**

Every numerical result shown in the UI or report must originate from the same deterministic calculation engine.

---

# 2. Existing repository audit

## 2.1 Current file structure

The current repository contains, among others:

```text
NMInteractionChart.jsx
PrecastPanel.jsx
PrecastPanelCalculation-revised.js
PrecastPanelCalculation.js
PrecastPanelConfig.js
PrecastPanelReport.jsx
```

The current `PrecastPanel.jsx` imports MUI components, KaTeX, the calculation engine, configuration, the N–M chart, SVG graphics and report components. It also holds the main component state and maps calculation results to UI blocks.

The current calculation engine has already moved toward a useful conceptual API:

```js
calculateInPlaneSectionChecks()
calculateBoundaryElementNM()
calculateInPlaneDesign()
calculateOutOfPlaneDesign()
calculateConnectionDesign()
calculateFoundationDesign()
buildDesignSummary()
calculatePrecastPanelDesign()
```

That public decomposition should be retained conceptually, but each calculation family should become its own module with typed input/output contracts.

## 2.2 Main problems to fix

### A. UI and engineering model use the same raw input object

Current code passes a broad object with application-specific names such as `wallWidth`, `wallHeight`, `fc`, `fy`, `VbarDia`, `VbarSpace`, etc. This makes it easy for UI refactoring to accidentally change engineering calculations.

**New rule:** create a canonical domain model.

```ts
DesignInput
  ├─ geometry
  ├─ materials
  ├─ reinforcement
  ├─ actions
  ├─ supportConditions
  ├─ seismic
  ├─ wind
  ├─ connections
  ├─ foundation
  ├─ durability
  └─ codeBasis
```

The UI form model may differ from the calculation model. A dedicated adapter converts the form model to `DesignInput`.

### B. Too many engineering constants can become hidden

Any coefficient that affects design must be traceable. Examples include:

- effective height/fixity coefficient `k`
- structural ductility factor `μ`
- structural performance factor `Sp`
- part response factor `Cph`
- spectral shape factors
- load combination factors
- resistance factors `φ`
- connection friction coefficient
- shear key contribution
- temperature/fire factors

These cannot live as unexplained numbers embedded in code.

**New rule:** every non-trivial coefficient must have:

```ts
{
  value,
  symbol,
  source,
  clause,
  table,
  edition,
  note,
  overrideAllowed
}
```

### C. Support condition logic is too generic

The current calculation file contains generic beam-style support moment factors such as pinned-pinned, fixed-free, fixed-fixed and fixed-pinned. These may be useful for simple preliminary beam checks, but the BRANZ slender-panel method is not simply a generic beam coefficient problem.

The new engine must distinguish:

1. physical support condition;
2. effective-height coefficient `k` used by the BRANZ stability methodology;
3. support condition for wind/seismic face loading;
4. support condition under fire;
5. support condition during construction/lifting;
6. whether a base out-of-plane plastic hinge is permitted/expected;
7. whether the top support is laterally, rotationally and torsionally restrained.

### D. OOP stability needs to be a first-class calculation family

The BRANZ guide explicitly treats slender-panel stability and the relationship between wall geometry, axial load, reinforcement and out-of-plane behaviour. A simple elastic beam deflection check is not sufficient for the intended application.

The new engine must expose:

```text
OOP face load
      ↓
cracked stiffness / effective stiffness
      ↓
P-Δ amplification
      ↓
serviceability displacement
      ↓
ULS displacement
      ↓
stability / lateral buckling criterion
      ↓
BRANZ stability acceptance
```

### E. Foundation design needs to be separated into load-transfer and footing design

A panel program should not hide the distinction between:

- wall-to-foundation connection;
- wall base shear transfer;
- wall overturning moment transfer;
- dowel tension/uplift;
- compression toe;
- foundation bearing;
- foundation sliding;
- footing flexure and shear;
- geotechnical bearing/settlement.

The first is structural connection design. The last is foundation design and should be separately configurable, including an option to pass demands to an external footing/geotechnical design module.

### F. Report code is duplicating engineering knowledge

The existing report implementation contains report-specific formula rendering and even a local N–M chart implementation to avoid circular references. This should be replaced with a report model generated by the engine.

The calculation engine should return:

```ts
CalculationStep[]
CheckResult[]
EquationReference[]
Assumption[]
Warning[]
```

The report renderer then only formats those objects.

---

# 3. Engineering scope of the new program

The first production version should support the following engineering workflow.

```text
1. Project and code basis
        ↓
2. Panel geometry
        ↓
3. Material and reinforcement
        ↓
4. Support / restraint model
        ↓
5. Gravity actions
        ↓
6. Wind actions
        ↓
7. Seismic actions
        ↓
8. Load combinations
        ↓
9. In-plane wall design
        ↓
10. Out-of-plane panel design
        ↓
11. Stability / P-Δ / lateral buckling
        ↓
12. Base connection
        ↓
13. Eaves/top connection
        ↓
14. Foundation demands / footing checks
        ↓
15. Serviceability / deflection
        ↓
16. Detailing checks
        ↓
17. Overall utilisation
        ↓
18. Engineering calculation report
```

The software should support two design philosophies:

### Mode A — Panel as part of the primary lateral system

Used where the panel resists in-plane earthquake/wind loads and transfers those actions to the foundation.

### Mode B — Panel as a face-loaded part / cladding-type structural element

Used where the panel does not participate as the principal building lateral-force-resisting system but must resist its own out-of-plane actions and maintain its connections.

These modes should be explicit in the UI and data model.

---

# 4. Code-basis architecture

## 4.1 Code basis must be data, not scattered strings

Create:

```text
src/domain/codeBasis/
  codeBasis.types.ts
  codeBasis.defaults.ts
  codeBasis.registry.ts
  codeBasis.validators.ts
  nzs3101.ts
  asnzs1170.ts
  nzs1170_5.ts
  branz2007.ts
```

Example:

```ts
export interface CodeReference {
  id: string;
  standard: string;
  edition: string;
  clause?: string;
  table?: string;
  equation?: string;
  description: string;
  applicability: string;
}
```

Example:

```ts
export const CODE_BASIS_NZ = {
  buildingCode: {
    standard: 'NZ Building Code',
    clause: 'B1'
  },
  actions: {
    general: 'AS/NZS 1170.0:2002',
    permanent: 'AS/NZS 1170.1:2002',
    wind: 'AS/NZS 1170.2:2021',
    earthquake: 'NZS 1170.5:2004'
  },
  concrete: {
    standard: 'NZS 3101.1&2:2006',
    amendments: ['A1', 'A2', 'A3']
  },
  slenderPanelGuide: {
    standard: 'BRANZ Slender Precast Concrete Panels with Low Axial Load',
    year: 2007
  }
};
```

## 4.2 Do not automatically upgrade standards

The application must show:

```text
Design Basis
────────────────────────────
Building Code: B1
Actions: AS/NZS 1170 series
Earthquake: NZS 1170.5:2004
Concrete: NZS 3101.1&2:2006 A3
Slender panel method: BRANZ 2007

[Current cited basis]
```

If a new technical specification or draft becomes available, it must be selectable as an **alternative design basis**, not silently substituted.

---

# 5. Canonical engineering data model

## 5.1 Geometry

```ts
interface PanelGeometry {
  width: number;              // m
  height: number;             // m
  thickness: number;          // mm or m, but canonical engine should use SI consistently
  opening?: OpeningModel[];
  effectiveHeight?: number;
  clearHeight?: number;
  supportSpacing?: number;
}
```

For production use, use a unit library or a single canonical unit convention. Recommended calculation convention:

- geometry: mm internally for concrete section mechanics;
- forces: kN internally at application boundary;
- moments: kN·m at application boundary;
- convert to N/mm within section calculations;
- never mix mm, m, N, kN and kN·m without explicit conversion helpers.

## 5.2 Materials

```ts
interface ConcreteMaterial {
  fc: number;
  density: number;
  Ec?: number;
  tensileStrength?: number;
}

interface ReinforcementMaterial {
  fy: number;
  Es: number;
  ductilityClass?: string;
}
```

## 5.3 Reinforcement

```ts
interface ReinforcementLayer {
  direction: 'vertical' | 'horizontal';
  diameter: number;
  spacing: number;
  fy: number;
  cover: number;
  side: 'single' | 'double';
}
```

## 5.4 Supports

```ts
interface SupportModel {
  base: {
    vertical: 'fixed' | 'pinned' | 'bearing';
    oop: 'fixed' | 'pinned' | 'free' | 'elastic';
    torsion: 'fixed' | 'free' | 'elastic';
  };
  top: {
    oop: 'fixed' | 'pinned' | 'free' | 'elastic';
    inPlane: 'fixed' | 'pinned' | 'free' | 'elastic';
  };
  effectiveHeightFactor?: number;
  effectiveHeightSource?: CodeReference;
}
```

## 5.5 Seismic model

```ts
interface SeismicModel {
  siteClass: string;
  hazardFactorZ: number;
  period?: number;
  ductilityFactor: number;
  performanceFactor: number;
  direction: 'X' | 'Y';
  accidentalEccentricity: number;
  partCategory?: string;
  partResponseFactor?: number;
  partSpectralShapeFactor?: number;
  partHeight?: number;
  buildingHeight?: number;
}
```

## 5.6 Actions

Do not store only final section actions. Store both source actions and derived actions.

```ts
interface ActionCase {
  id: string;
  type: 'G' | 'Q' | 'W' | 'E' | 'T' | 'FIRE' | 'CUSTOM';
  description: string;
  N?: number;
  M?: number;
  V?: number;
  w?: number;
  pressure?: number;
  source?: CodeReference;
}
```

Then calculate:

```ts
interface SectionDemand {
  Nstar: number;
  Mstar: number;
  Vstar: number;
  combinationId: string;
}
```

---

# 6. Calculation engine architecture

Recommended structure:

```text
src/
  domain/
    codeBasis/
    model/
    materials/
    loads/
    results/

  engineering/
    actions/
      combinations/
      wind/
      seismic/
      parts/
    section/
      rectangularSection.ts
      reinforcementLayout.ts
      strainCompatibility.ts
      nmInteraction.ts
    inPlane/
      inPlaneDemand.ts
      inPlaneSection.ts
      inPlaneShear.ts
      inPlaneFlexure.ts
      boundaryElement.ts
    outOfPlane/
      oopLoads.ts
      effectiveStiffness.ts
      pDelta.ts
      deflection.ts
      stability.ts
      branzSlenderPanel.ts
    connections/
      baseDowel.ts
      groutBond.ts
      shearKey.ts
      friction.ts
      eavesConnection.ts
    foundation/
      bearing.ts
      sliding.ts
      uplift.ts
      footingFlexure.ts
      footingShear.ts
    serviceability/
      deflection.ts
      cracking.ts
      movement.ts

  application/
    runDesign.ts
    validateInput.ts
    buildReportModel.ts

  ui/
    components/
    hooks/
    forms/
    charts/
    diagrams/
    report/
```

---

# 7. Calculation result contract

Every engineering calculation should return a standard object.

```ts
interface CalculationStep {
  id: string;
  title: string;
  equation?: string;
  variables?: Record<string, number | string>;
  result?: number | string;
  units?: string;
  source?: CodeReference[];
  assumptions?: string[];
  notes?: string[];
}

interface CheckResult {
  id: string;
  title: string;
  demand: number;
  capacity: number;
  utilisation: number;
  status: 'PASS' | 'WARNING' | 'FAIL' | 'NOT_CHECKED';
  units: string;
  source?: CodeReference[];
  governing?: boolean;
}
```

This is the central reporting strategy.

The UI should never need to reconstruct engineering formulas from raw numbers.

---

# 8. Engineering modules

## 8.1 Load combinations

The first module should centralise all ULS/SLS combinations.

Required functionality:

```text
G
Q
W(+)
W(-)
E(+)
E(-)

ULS combinations
SLS frequent / quasi-permanent as applicable
Seismic combinations
Orthogonal earthquake action combinations where applicable
Construction / lifting combinations if selected
Fire combinations if selected
```

Every combination gets an ID and code reference.

Example:

```ts
{
  id: 'ULS_E_X_POS',
  actions: [
    { case: 'G', factor: ... },
    { case: 'Q', factor: ... },
    { case: 'E_X', factor: ... }
  ],
  source: {
    standard: 'AS/NZS 1170.0:2002',
    clause: '...'
  }
}
```

Do not embed combination equations inside individual wall checks.

---

# 9. Seismic calculation module

This module must separate:

### A. Building-level seismic action

```text
site hazard
     ↓
period T
     ↓
structural ductility μ
     ↓
Sp
     ↓
design action coefficient
     ↓
base shear
     ↓
diaphgram / wall distribution
```

### B. Panel as a structural component / part

```text
panel weight Wp
     ↓
part spectral coefficient Cp(Tp)
     ↓
floor height coefficient
     ↓
part response factor
     ↓
Fp
     ↓
connection demand
```

The BRANZ guide explicitly includes an Appendix C treatment of the panel as a building part using the parts provisions of NZS 1170.5. This must be implemented independently of the building-level lateral system calculation.

---

# 10. In-plane design module

The in-plane module should perform the following sequence.

```text
Geometry
↓
Ag / Ig / section dimensions
↓
gravity axial load
↓
seismic / wind lateral actions
↓
N*, M*, V*
↓
service stress check
↓
N-M interaction
↓
flexural capacity
↓
shear capacity
↓
tension / anchorage demand
↓
boundary element check where required
↓
curvature / ductility limitation
↓
final utilisation
```

## 10.1 N-M interaction

Do not use a hand-picked closed form when the reinforcement arrangement is explicitly defined.

Use a strain compatibility solver.

```text
for neutral axis c:
    concrete strain distribution
    steel strain for each bar
    steel stress = Es ε, capped at fy
    concrete compression block
    N(c)
    M(c)

solve N(c) ≈ Ntarget
then obtain Mcapacity
```

Create one common solver that is reused by:

- main panel N-M;
- local boundary element N-M;
- connection anchor-group checks where appropriate;
- future wall openings / pier checks.

---

# 11. Out-of-plane design module

This should become one of the most rigorous parts of the program.

## 11.1 Input states

At minimum:

```text
self weight
roof load if supported
wind pressure / suction
seismic part load
thermal differential if selected
fire state if selected
construction state if selected
```

## 11.2 Panel support state

Distinguish:

```text
base rotational restraint
base lateral restraint
top lateral restraint
top rotation restraint
torsional restraint
roof diaphragm flexibility
portal flexibility
```

## 11.3 Effective section properties

The BRANZ guide uses effective section properties for slender panels and explicitly discusses effective flexural stiffness in the context of wall response.

Create:

```ts
calculateGrossSectionProperties()
calculateCrackedSectionProperties()
calculateEffectiveInertia()
calculateEffectiveEI()
```

Return all intermediate values with source references.

## 11.4 P-Delta

The calculation flow should be iterative where required:

```text
initial action
↓
initial curvature/deflection
↓
additional M = P × Δ
↓
updated total M
↓
updated stiffness
↓
updated Δ
↓
repeat until convergence
```

Return:

```ts
{
  iterations,
  converged,
  initialMoment,
  pDeltaMoment,
  finalMoment,
  maxDeflection,
  convergenceError
}
```

A failure to converge must be a **calculation warning/failure**, not a silent fallback to the previous iteration.

---

# 12. BRANZ slender-panel stability module

This needs its own implementation and test set.

The program should expose:

```text
H/t
L/H
kH/t
kH/r
ρ
fy
fc'
P
W
P + 0.5W
geometric stability parameter
Euler-type stability parameter
Vlasov/Timoshenko-type stability parameter
```

The BRANZ guide discusses a stability approach based on a compression-strut/Euler concept and a Vlasov/Timoshenko relationship. The program should implement those two checks as identifiable methods rather than hiding them under a generic “buckling” flag.

### Required output

```text
Stability method: Euler compression-strut
Result: PASS / FAIL

Stability method: Vlasov/Timoshenko
Result: PASS / FAIL

Overall BRANZ stability check
Result: PASS / FAIL
```

The program should also show which assumptions were activated, especially the effective-height coefficient `k` and whether an out-of-plane base hinge is assumed.

---

# 13. Connections module

Connections must be treated as independent structural components.

## 13.1 Base connection

Break it into:

```text
Dowel tension
Dowel shear
Grout bond / development
Shear key
Friction
Concrete edge / breakout as applicable
Bearing
Combined action
```

Do not use an unexplained global equation such as:

```text
VshearKey = 0.15 × VdowelSteel
```

unless that relationship is explicitly identified as a project-specific empirical assumption, with a code/reference field and a UI warning.

## 13.2 Eaves/top connection

Calculate:

```text
seismic part demand
wind demand
panel inertial force
roof flexibility amplification where applicable
connection tension
connection shear
anchor demand
local concrete capacity
steel capacity
```

The BRANZ guide highlights the importance of reliable eaves connections for slender panel response and discusses possible force amplification. The program must not merge the eaves connection demand with the base connection demand.

---

# 14. Foundation module

Use a three-level model.

### Level 1 — demand extraction

```text
Mbase
Vbase
Nbase
Tbase
compression toe
```

### Level 2 — wall/base interface

```text
compression block
base dowel uplift
base dowel shear
friction
shear key
```

### Level 3 — footing

```text
bearing pressure
uplift / loss of contact
sliding
footing flexure
footing one-way shear
footing punching where applicable
```

For uplift, explicitly calculate the triangular compression/contact distribution rather than forcing `qmin` negative and declaring failure.

Example conceptual calculation:

```text
Resultant outside kern
        ↓
partial-contact state
        ↓
compression toe location
        ↓
contact width
        ↓
triangular bearing pressure
        ↓
compression resultant
        ↓
base moment equilibrium
        ↓
dowel uplift demand
```

This is especially important for the type of panel/base behaviour described by BRANZ.

---

# 15. Serviceability module

Separate SLS from ULS.

Checks should include, as applicable:

```text
OOP service deflection
crack/strain-related limits
in-plane drift
roof / eaves movement compatibility
sealant/joint movement
thermal movement
construction tolerance / connection movement
```

The BRANZ guide discusses service out-of-plane deflection and notes a commonly referenced height/400 criterion in the earthquake commentary context; the software should identify such criteria by source instead of hard-coding `H/400` as a universal limit.

---

# 16. Material and detailing validation

Before running structural calculations, run a design-input compliance validator.

Examples:

```text
minimum wall thickness
single-layer reinforcement eligibility
bar diameter limits
spacing limits
reinforcement ratio limits
cover
minimum development / anchorage
steel grade
concrete strength
ductility factor compatibility
curvature ductility limitations
```

The BRANZ guide notes, for example, minimum wall-thickness and reinforcement/detailing limits derived from NZS 3101 provisions. These should be represented as explicit code checks, not merely tooltip text.

---

# 17. Engineering warning framework

A professional calculation program must distinguish:

### PASS
Requirement verified.

### PASS — HIGH UTILISATION
Capacity is adequate but utilisation exceeds the configurable warning threshold.

### WARNING
Calculation is possible but an engineering judgement or manual review is required.

### NOT CHECKED
A required input or design path has not been selected.

### FAIL
The requirement is not satisfied.

### OUT OF SCOPE
The selected wall/building configuration is outside the validated domain of the chosen method.

This is better than a simple boolean `overallOK`.

---

# 18. Scope-of-validity engine

Create a mandatory front-end/back-end check before calculation.

Example:

```ts
interface ScopeCheck {
  id: string;
  status: 'PASS' | 'WARNING' | 'FAIL' | 'OUT_OF_SCOPE';
  message: string;
  source: CodeReference[];
}
```

The BRANZ guide specifically defines a slender-panel application domain involving low axial load and particular support/configuration assumptions. Therefore the program must not let the user treat the BRANZ method as a universal wall design method.

Examples of automatic scope warnings:

```text
Axial load exceeds BRANZ low-axial-load domain.

Wall has continuous vertical edge support.

Wall supports intermediate floor loads.

Wall geometry is outside validated test/calculation envelope.

Multiple reinforcement layers selected for a method intended for single-layer panels.

Ductility selection incompatible with selected detailing.
```

The application should allow an engineer to continue only after acknowledging an out-of-scope condition, or stop automatically for hard exclusions.

---

# 19. UI architecture — Material UI + React 18

The UI should be organised around engineering workflow rather than the current “large accordion page” concept.

Recommended layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ PCP | Project | Panel ID | Design Basis | Save | Report      │
├───────────────┬─────────────────────────────────────────────┤
│ 1 Geometry    │                                             │
│ 2 Materials   │                 Main workspace               │
│ 3 Rebar       │                                             │
│ 4 Actions     │   Inputs / diagram / chart / calculation    │
│ 5 Supports    │                                             │
│ 6 Seismic     │                                             │
│ 7 Wind        │                                             │
│ 8 Connections │                                             │
│ 9 Foundation  │                                             │
│               │                                             │
│               │                                             │
├───────────────┴─────────────────────────────────────────────┤
│ Overall Result | Governing Check | Warnings | Utilisation    │
└─────────────────────────────────────────────────────────────┘
```

## 19.1 Recommended React feature structure

```text
src/features/precast-panel/
  pages/
    PrecastPanelPage.tsx

  components/
    PanelHeader.tsx
    DesignBasisCard.tsx
    GeometryCard.tsx
    MaterialCard.tsx
    ReinforcementCard.tsx
    ActionCard.tsx
    SeismicCard.tsx
    WindCard.tsx
    SupportCard.tsx
    ConnectionCard.tsx
    FoundationCard.tsx
    ResultsSummary.tsx
    CheckTable.tsx
    CalculationAccordion.tsx
    NMInteractionChart.tsx
    OOPDeflectionChart.tsx
    PanelDiagram.tsx
    ReportPreview.tsx

  hooks/
    usePrecastPanelForm.ts
    usePrecastPanelCalculation.ts

  adapters/
    formToDesignInput.ts
    calculationToViewModel.ts
```

## 19.2 MUI design system

Create a single theme:

```text
src/theme/
  theme.ts
  components.ts
  typography.ts
  statusColors.ts
```

Controls should use a single reusable component family:

```text
NumericField
SelectField
UnitField
SwitchField
SectionHeader
EngineeringInfoTooltip
StatusChip
UtilisationBar
```

Do not hand-style individual fields in each section.

---

# 20. Input UI philosophy

Each input should show:

```text
Label
Unit
Current value
Min / max
Optional source
Engineering tooltip
Validation status
```

Example:

```text
Wall Thickness                         [150] mm
──────────────────────────────────────────────
NZS 3101 / BRANZ validity               ✓
Minimum                               100 mm
```

For code-derived parameters, use a small “Code” chip:

```text
μ = 3.0          [Code]
Sp = 0.7         [Code]
```

Clicking it opens the source/assumption panel.

---

# 21. Calculation tab

The calculation tab should not simply print all internal variables.

Use a hierarchical structure:

```text
1. Design Basis
2. Geometry and material properties
3. Design actions
4. In-plane design
   4.1 Section properties
   4.2 N-M interaction
   4.3 Shear
   4.4 Detailing
5. Out-of-plane design
   5.1 Face loading
   5.2 Effective stiffness
   5.3 P-Δ
   5.4 Deflection
   5.5 Stability
6. Connections
7. Foundation interface
8. Serviceability
9. Governing checks
```

Each section shows only the main engineering equations by default, with a “Show calculation detail” expansion.

---

# 22. Results page

The first screen should answer three questions:

```text
1. Does it pass?
2. What governs?
3. What must the engineer review?
```

Example:

```text
OVERALL
✓ PASS

Governing utilisation: 0.87
Governing check: OOP stability

In-plane flexure        0.42  ✓
In-plane shear          0.31  ✓
OOP moment              0.78  ✓
OOP stability           0.87  ✓
Base connection         0.63  ✓
Foundation bearing      0.55  ✓

Warnings: 2
Manual review: roof diaphragm flexibility
```

---

# 23. N-M interaction chart

The N-M chart should be driven directly from the common section solver.

Do not maintain a separate mathematical implementation in the chart component.

```text
engineering/section/nmInteraction.ts
                   ↓
             curveNominal
             curveDesign
             keyPoints
             demandPoints
                   ↓
ui/charts/NMInteractionChart.tsx
```

The chart component should only know how to plot:

```ts
curveNominal
curveDesign
demandPoints
keyPoints
```

The report should use the exact same curve data.

---

# 24. Diagram architecture

All engineering diagrams should become parameterised components.

```text
PanelDiagram
  ├─ PanelGeometryGraphic
  ├─ ReinforcementGraphic
  ├─ InPlaneActionGraphic
  ├─ OutOfPlaneActionGraphic
  ├─ BaseConnectionGraphic
  ├─ EavesConnectionGraphic
  └─ FoundationGraphic
```

The diagram receives engineering values.

```ts
<PanelDiagram
  height={result.geometry.height}
  width={result.geometry.width}
  thickness={result.geometry.thickness}
  Mstar={result.demands.Mstar}
  Vstar={result.demands.Vstar}
  Nstar={result.demands.Nstar}
/>
```

No calculation should occur inside SVG components.

---

# 25. Report architecture

Replace the existing report logic with a report model.

```ts
interface DesignReportModel {
  project: ProjectInfo;
  designBasis: DesignBasisSummary;
  inputSummary: InputSummary;
  calculationSections: ReportSection[];
  checkSummary: CheckResult[];
  warnings: Warning[];
  assumptions: Assumption[];
  figures: ReportFigure[];
  signoff: SignoffBlock;
}
```

Then:

```text
calculation engine
       ↓
DesignReportModel
       ↓
PrecastPanelReport.jsx
       ↓
HTML / print CSS / PDF
```

The report module must not recalculate anything.

---

# 26. Audit trail

Every design run should be reproducible.

Store:

```json
{
  "applicationVersion": "1.0.0",
  "calculationEngineVersion": "1.0.0",
  "codeBasisVersion": "NZ-2006A3-1170-2021-BRANZ2007",
  "timestamp": "...",
  "designInput": {},
  "calculationSettings": {},
  "results": {},
  "warnings": [],
  "assumptions": [],
  "manualOverrides": []
}
```

This is essential for engineering QA and for later comparing revisions.

---

# 27. Testing strategy

## 27.1 Unit tests

Every engineering function must have direct tests.

```text
areaBar()
sectionProperties()
strainAtBar()
steelStress()
concreteBlockForce()
solveNeutralAxis()
calculateShearCapacity()
calculatePDelta()
calculateEulerStability()
calculateVlasovStability()
calculateDowelCapacity()
calculateBearing()
```

## 27.2 Engineering benchmark tests

Build benchmark cases from:

1. BRANZ Example Design Calculations;
2. known hand calculations;
3. previous validated PCP outputs;
4. deliberately failing examples;
5. edge cases.

Each benchmark should specify:

```text
input
expected intermediate values
expected governing check
expected utilisation
expected PASS/FAIL
```

## 27.3 Regression tests

A code refactor must not silently change engineering answers.

Keep JSON snapshots:

```text
tests/benchmarks/
  branz-example-01.json
  branz-example-02.json
  oop-stability-01.json
  inplane-nm-01.json
  connection-01.json
  foundation-uplift-01.json
```

---

# 28. Numerical solver requirements

Avoid ad-hoc loops without convergence controls.

Use a reusable root solver interface:

```ts
interface SolverOptions {
  tolerance: number;
  maxIterations: number;
  lowerBound: number;
  upperBound: number;
}
```

Return:

```ts
{
  root,
  converged,
  iterations,
  residual,
  message
}
```

A numerical failure must be visible to the user.

---

# 29. Units architecture

This deserves its own module.

```text
src/engineering/units/
  force.ts
  moment.ts
  stress.ts
  length.ts
  conversion.ts
```

Never write:

```js
value * 1e6
```

in the middle of an engineering calculation without a named helper.

Prefer:

```ts
kNmToNmm(Mstar)
```

or a typed quantity system.

---

# 30. Configuration architecture

The current `PrecastPanelConfig.js` should be split into:

```text
code defaults
material presets
rebar presets
support presets
UI metadata
validation rules
```

Example:

```text
config/
  codeDefaults.ts
  materialPresets.ts
  reinforcementPresets.ts
  supportPresets.ts
  inputSchema.ts
  validationRules.ts
```

The configuration layer describes **what can be entered**.

The calculation engine defines **how it is calculated**.

---

# 31. Recommended folder structure

```text
src/
├─ app/
│  ├─ App.tsx
│  ├─ routes.tsx
│  └─ providers/
│
├─ domain/
│  ├─ model/
│  ├─ codeBasis/
│  ├─ validation/
│  └─ results/
│
├─ engineering/
│  ├─ actions/
│  │  ├─ combinations/
│  │  ├─ wind/
│  │  ├─ seismic/
│  │  └─ parts/
│  │
│  ├─ materials/
│  ├─ section/
│  │  ├─ sectionProperties.ts
│  │  ├─ strainCompatibility.ts
│  │  ├─ nmInteraction.ts
│  │  └─ reinforcement.ts
│  │
│  ├─ inPlane/
│  ├─ outOfPlane/
│  │  ├─ effectiveStiffness.ts
│  │  ├─ pDelta.ts
│  │  ├─ deflection.ts
│  │  └─ stability.ts
│  │
│  ├─ connections/
│  ├─ foundation/
│  └─ serviceability/
│
├─ application/
│  ├─ runDesign.ts
│  ├─ validateDesign.ts
│  └─ buildReportModel.ts
│
├─ features/
│  └─ precast-panel/
│     ├─ pages/
│     ├─ components/
│     ├─ forms/
│     ├─ charts/
│     ├─ diagrams/
│     └─ adapters/
│
├─ report/
│  ├─ PrecastPanelReport.tsx
│  ├─ reportModel.ts
│  └─ reportStyles.css
│
├─ theme/
│  ├─ theme.ts
│  └─ components.ts
│
└─ tests/
   ├─ unit/
   ├─ integration/
   └─ benchmarks/
```

---

# 32. AI coding workflow

The AI should not be asked to “rewrite the whole app” in one prompt.

Use staged prompts and require each stage to preserve the working application.

The correct development sequence is:

```text
Prompt 00  → Repository audit
Prompt 01  → Freeze existing calculation outputs
Prompt 02  → Engineering domain model
Prompt 03  → Code-basis registry
Prompt 04  → Unit system
Prompt 05  → Action/load engine
Prompt 06  → Section/N-M engine
Prompt 07  → In-plane engine
Prompt 08  → OOP engine
Prompt 09  → BRANZ stability engine
Prompt 10  → Connection engine
Prompt 11  → Foundation interface
Prompt 12  → Serviceability
Prompt 13  → Result/report model
Prompt 14  → React/MUI UI refactor
Prompt 15  → Charts/diagrams
Prompt 16  → Report
Prompt 17  → Full regression tests
Prompt 18  → Engineering QA review
```

---

# 33. AI PROMPT 00 — Repository audit

```text
You are a senior software architect and New Zealand structural engineer.

Repository: https://github.com/abulabadabula/pcp/tree/main

Task:
Perform a complete architecture and engineering audit of the current PCP project.

Do not modify files yet.

Inspect all source files and identify:
1. React component responsibilities.
2. Calculation-engine responsibilities.
3. UI state responsibilities.
4. Configuration responsibilities.
5. Report responsibilities.
6. Engineering formulas currently implemented.
7. Hard-coded engineering coefficients.
8. Unit conversions.
9. Support-condition assumptions.
10. NZS 3101 assumptions.
11. AS/NZS 1170 assumptions.
12. BRANZ slender-panel assumptions.
13. Connection assumptions.
14. Foundation assumptions.
15. Numerical solver assumptions.
16. Any duplicated calculations.
17. Any calculations implemented in JSX.
18. Any calculations implemented independently in the report/chart layer.
19. Any questionable empirical coefficients.
20. Any calculations that need an explicit code citation.

Produce:
A. Current architecture diagram.
B. Current calculation data flow.
C. File-by-file responsibility table.
D. Engineering calculation inventory.
E. Risk/priority table.
F. Proposed target architecture.

Important:
- Do not silently “correct” calculations during the audit.
- Flag them for review.
- Preserve the current repository until the refactor plan is approved.
```

---

# 34. AI PROMPT 01 — Freeze current results

```text
Before refactoring the PCP calculation engine, create a regression-test baseline.

Task:
1. Identify representative current input cases.
2. Run the current calculation engine.
3. Save the full result objects as JSON fixtures.
4. Include intermediate values, not only final PASS/FAIL.
5. Create tests that verify the existing implementation exactly.
6. Mark these tests as LEGACY BASELINE.

Do not improve engineering formulas in this task.

The purpose is to ensure that architecture refactoring does not accidentally change results.
```

---

# 35. AI PROMPT 02 — Engineering domain model

```text
Create a new typed domain model for the PCP precast concrete panel design application.

Requirements:
- React 18 remains unchanged.
- Material UI remains unchanged.
- The engineering domain model must not import React or MUI.
- Use TypeScript for all new calculation/domain modules.
- Preserve a JavaScript adapter where necessary for existing code.

Create:
1. DesignInput.
2. PanelGeometry.
3. MaterialModel.
4. ReinforcementModel.
5. SupportModel.
6. ActionCase.
7. LoadCombination.
8. SeismicModel.
9. WindModel.
10. ConnectionModel.
11. FoundationModel.
12. DesignBasis.
13. CalculationStep.
14. CheckResult.
15. Warning.
16. ScopeCheck.
17. DesignResult.

Do not move formulas yet.

Add validation schemas and conversion helpers.
```

---

# 36. AI PROMPT 03 — Code-basis registry

```text
Create a formal code-basis registry for the PCP application.

Required sources:
- NZ Building Code B1.
- AS/NZS 1170.0.
- AS/NZS 1170.1.
- AS/NZS 1170.2:2021.
- NZS 1170.5:2004.
- NZS 3101.1&2:2006 including incorporated amendments.
- BRANZ 2007 Slender Precast Concrete Panels with Low Axial Load.

Requirements:
1. Each engineering coefficient must be traceable to a CodeReference.
2. Store standard, edition, clause, table/equation if applicable.
3. Do not silently use TS 1170.5 as a replacement for NZS 1170.5:2004.
4. Permit explicit alternative code-basis profiles.
5. Add scope-of-validity metadata.
6. Add warning text for assumptions.

Create unit tests for the registry.
```

---

# 37. AI PROMPT 04 — Unit system

```text
Refactor the PCP engineering calculations to use a controlled unit system.

Requirements:
- No unexplained 1e3 or 1e6 conversion constants inside engineering formulas.
- Create explicit unit conversion functions.
- Define the application boundary units.
- Define the calculation-engine units.
- Add tests for every conversion.
- Search the legacy engine for all implicit conversions.
- Replace them only after creating regression tests.

The output must include a unit-convention document.
```

---

# 38. AI PROMPT 05 — Actions engine

```text
Create the actions and load-combination engine.

Implement separate modules for:
1. Permanent actions.
2. Imposed actions.
3. Wind actions based on AS/NZS 1170.2:2021.
4. Building-level earthquake actions based on NZS 1170.5:2004.
5. Part/component earthquake actions based on NZS 1170.5:2004 Section 8 where applicable.
6. Accidental eccentricity.
7. Orthogonal seismic actions where required by the selected design philosophy.
8. ULS/SLS action combinations.

Every returned load must carry:
- case ID,
- direction,
- magnitude,
- unit,
- source code reference,
- assumptions.

Do not implement panel resistance in this task.
```

---

# 39. AI PROMPT 06 — Section mechanics and N-M engine

```text
Create a generic reinforced-concrete rectangular wall section engine.

Requirements:
- Gross section properties.
- Cracked section properties.
- Effective stiffness inputs.
- Reinforcement layout.
- Strain compatibility.
- Concrete compression block.
- Steel stress-strain limiting to the selected material model.
- Neutral-axis solving.
- N-M interaction curve.
- Design-strength curve.
- Demand-point interpolation.
- Balanced point.
- Pure compression point.
- Pure bending point.

The same solver must be reusable for:
- main wall section,
- local boundary element,
- future wall-pier/opening checks.

The chart component must not calculate any engineering values.
```

---

# 40. AI PROMPT 07 — In-plane design

```text
Refactor the in-plane wall design into a pure engineering module.

Implement:
1. Geometry classification.
2. Section properties.
3. Gravity actions.
4. Seismic/wind in-plane actions.
5. N*, M*, V*.
6. N-M flexural interaction.
7. Shear strength.
8. Reinforcement ratio checks.
9. Reinforcement spacing and bar diameter checks.
10. Anchorage/development checks relevant to in-plane action.
11. Curvature/ductility limitations.
12. Boundary-element local N-M where explicitly required.

Use NZS 3101 references for all code checks.
Use BRANZ guidance for slender-panel-specific limitations.

Return structured CalculationStep[] and CheckResult[].
No React imports.
```

---

# 41. AI PROMPT 08 — Out-of-plane panel design

```text
Create the out-of-plane panel design engine for a slender precast concrete panel.

The engine must separately handle:
1. Wind face loading.
2. Seismic part loading.
3. Panel self-weight where relevant.
4. Roof/eaves axial load.
5. Thermal action if selected.
6. Fire state if selected.
7. Support conditions.
8. Effective height.
9. Gross and cracked stiffness.
10. P-Delta.
11. ULS moment.
12. SLS deflection.
13. OOP support reactions.
14. Stability assessment.

Use a controlled iterative solver for P-Delta.

Do not use generic beam support coefficients as a substitute for the BRANZ slender-panel methodology.

Return a transparent iteration record and all governing intermediate variables.
```

---

# 42. AI PROMPT 09 — BRANZ stability

```text
Implement the BRANZ 2007 slender-panel stability methodology as a dedicated calculation module.

Implement separately:
A. Euler compression-strut stability approach.
B. Vlasov/Timoshenko stability relationship.
C. Effective-height coefficient selection.
D. Geometry/slenderness checks.
E. Low-axial-load applicability check.
F. Reinforcement/load interaction stability parameter.
G. Optional graphical stability plot.

Requirements:
- No hard-coded unexplained constants.
- Every coefficient must carry a CodeReference.
- Include an assumption record for k.
- Return PASS/FAIL/OUT_OF_SCOPE independently for each criterion.
- Do not replace the BRANZ method with a generic Euler buckling formula.

Create benchmark tests from the BRANZ example calculations and stability discussion.
```

---

# 43. AI PROMPT 10 — Connections

```text
Build a modular precast panel connection engine.

Separate:
1. Base dowel tension.
2. Base dowel shear.
3. Grout bond/development.
4. Shear key.
5. Friction.
6. Combined connection action.
7. Eaves/top connection.
8. Connection force amplification where applicable.
9. Local concrete failure modes where applicable.
10. Steel failure modes.

Never hide empirical assumptions in generic multipliers.

Every capacity equation must return its source reference and controlling failure mode.

Allow different connection types through a connection-type registry.
```

---

# 44. AI PROMPT 11 — Foundation / uplift

```text
Create the foundation interface and footing-demand engine.

The wall-to-foundation interface shall explicitly calculate:
- N,
- M,
- V,
- compression toe,
- partial contact width,
- triangular compression pressure distribution,
- base dowel uplift demand,
- base shear demand.

The footing module shall separately calculate:
- bearing,
- sliding,
- uplift/contact loss,
- footing flexure,
- one-way shear,
- punching if applicable.

Do not use a simplistic qmin < 0 = FAIL rule where partial-contact equilibrium is a legitimate design state.

All assumptions about allowable bearing pressure, friction and geotechnical parameters must be explicit inputs.
```

---

# 45. AI PROMPT 12 — Serviceability

```text
Create a separate SLS module.

Implement:
- OOP deflection.
- In-plane drift.
- roof/eaves movement compatibility.
- thermal movement if selected.
- connection movement.
- cracking/serviceability indicators where required.

Do not reuse ULS capacity equations as SLS checks unless technically justified and documented.

Every serviceability limit must be identified by source and applicability.
```

---

# 46. AI PROMPT 13 — Result/report model

```text
Create a calculation-result and report model independent of React.

The engine must return:
- design basis;
- input summary;
- action summary;
- calculation steps;
- checks;
- utilisation ratios;
- warnings;
- assumptions;
- out-of-scope messages;
- governing checks;
- diagrams data;
- N-M curve data;
- OOP deflection data;
- audit metadata.

The report must never recalculate engineering values.

Build a ReportModel adapter from DesignResult.
```

---

# 47. AI PROMPT 14 — React / MUI refactor

```text
Refactor the PCP React 18 frontend around the new engineering domain model.

Requirements:
- Keep Material UI.
- Do not change engineering formulas.
- Remove calculation logic from JSX.
- Replace direct raw-object manipulation with form adapters.
- Use reusable MUI field components.
- Use one validation system.
- Use one calculation hook.
- Memoise expensive calculation results.
- Prevent unnecessary recalculation when irrelevant UI state changes.
- Preserve all current user-facing capabilities.

Create:
PrecastPanelPage
DesignBasisPanel
GeometryPanel
MaterialPanel
ReinforcementPanel
ActionsPanel
SeismicPanel
WindPanel
SupportPanel
ConnectionPanel
FoundationPanel
ResultsPanel
CalculationPanel
ReportPanel

Do not create duplicate engineering models inside components.
```

---

# 48. AI PROMPT 15 — Charts and engineering graphics

```text
Refactor all engineering charts and diagrams.

Requirements:
- No engineering formulas inside chart components.
- Consume only structured chart data from the calculation result.
- Build reusable parameterised SVG diagrams.
- Keep screen and print rendering consistent.
- Support:
  1. N-M interaction chart.
  2. OOP deflection shape.
  3. Base uplift/compression toe diagram.
  4. Load diagram.
  5. Wall geometry.
  6. Connection force diagram.
  7. BRANZ stability plot.

All diagrams must have a clean view model independent of the engineering calculation layer.
```

---

# 49. AI PROMPT 16 — Professional report

```text
Build a professional engineering calculation report for the PCP system.

Required sections:
1. Project information.
2. Design basis.
3. Scope and limitations.
4. Panel geometry.
5. Materials and reinforcement.
6. Design actions.
7. In-plane design.
8. Out-of-plane design.
9. BRANZ stability.
10. Base connection.
11. Eaves connection.
12. Foundation interface.
13. Serviceability.
14. Governing utilisation.
15. Warnings/assumptions.
16. Summary of compliance.
17. Engineer review/sign-off area.
18. Software version and calculation-engine version.

Use only ReportModel data.
Do not calculate engineering values in the report JSX.
```

---

# 50. AI PROMPT 17 — Full regression suite

```text
Create the full regression and engineering benchmark suite for PCP.

Requirements:
1. Preserve all legacy baseline tests.
2. Add BRANZ example cases.
3. Add NZS 3101 section-design cases.
4. Add NZS 1170.5 seismic cases.
5. Add wind cases.
6. Add OOP P-Delta convergence cases.
7. Add stability pass/fail cases.
8. Add connection failure-mode cases.
9. Add partial-contact foundation cases.
10. Add invalid-input cases.
11. Add out-of-scope cases.
12. Add snapshot tests for report models.
13. Add UI tests for critical input/result flows.

Every failed engineering benchmark must report:
- input,
- expected,
- actual,
- numerical difference,
- likely cause.
```

---

# 51. AI PROMPT 18 — Independent engineering QA review

```text
Act as an independent senior New Zealand structural engineer performing a software verification review of PCP.

Do not modify code immediately.

Review:
1. AS/NZS 1170.0 action combinations.
2. AS/NZS 1170.1 permanent/imposed actions.
3. AS/NZS 1170.2 wind actions.
4. NZS 1170.5 building seismic actions.
5. NZS 1170.5 parts/components.
6. NZS 3101 concrete section design.
7. NZS 3101 wall detailing.
8. BRANZ slender-panel applicability.
9. BRANZ stability methodology.
10. P-Delta implementation.
11. Connection calculations.
12. Foundation load transfer.
13. Numerical convergence.
14. Unit consistency.
15. Report traceability.
16. Regression test coverage.

Produce:
A. Critical errors.
B. Major errors.
C. Minor errors.
D. Engineering judgement items.
E. Out-of-scope items.
F. Recommended fixes.

Do not claim code compliance merely because numerical tests pass.
```

---

# 52. Migration strategy from current PCP

Do not delete the existing system at the beginning.

Recommended migration:

```text
Phase 0
Current PCP
   │
   ├── legacy calculation engine
   └── legacy UI

Phase 1
Create tests + new domain model
   │
   └── legacy engine still active

Phase 2
New section engine
   │
   └── compare old/new

Phase 3
New in-plane engine

Phase 4
New OOP + BRANZ stability

Phase 5
New connections/foundation

Phase 6
New report model

Phase 7
New React/MUI UI

Phase 8
Switch default calculation engine

Phase 9
Archive legacy engine
```

During migration, implement a comparison adapter:

```ts
compareDesignResults(legacyResult, newResult)
```

Output:

```text
parameter                legacy      new       difference
----------------------------------------------------------
Ag                       ...         ...       ...
Mcapacity                ...         ...       ...
Vcapacity                ...         ...       ...
OOP deflection           ...         ...       ...
stability parameter      ...         ...       ...
connection capacity      ...         ...       ...
```

---

# 53. Minimum first release

The first production-quality release should include:

### Inputs
- geometry;
- concrete;
- reinforcement;
- support conditions;
- permanent load;
- imposed load;
- wind;
- seismic;
- design philosophy;
- base connection;
- foundation interface.

### Calculations
- code-basis validation;
- ULS/SLS combinations;
- in-plane N-M;
- in-plane shear;
- OOP face loading;
- effective stiffness;
- P-Delta;
- service deflection;
- BRANZ stability;
- base connection;
- foundation bearing/sliding/uplift.

### Outputs
- overall pass/fail;
- utilisation summary;
- governing case;
- warning list;
- N-M interaction diagram;
- OOP deflection diagram;
- base uplift/contact diagram;
- detailed calculation report.

---

# 54. Later releases

## Release 1.1

- better wind-pressure import;
- more connection types;
- improved fire-state module;
- additional footing checks;
- project save/load.

## Release 1.2

- multi-panel building model;
- diaphragm stiffness;
- distribution of base shear between panel groups;
- accidental eccentricity model;
- wall-panel layout.

## Release 2.0

- whole-building precast wall system;
- multiple panels;
- openings;
- portal frames;
- roof diaphragm interaction;
- automated panel grouping;
- BIM/IFC geometry input;
- Python/FastAPI backend;
- database/audit history;
- automated engineering report generation.

---

# 55. Backend-ready architecture

Even if the calculation engine starts in the browser, design the API boundary now.

Recommended future endpoint:

```http
POST /api/v1/precast-panel/design
```

Request:

```json
{
  "designBasis": {},
  "input": {}
}
```

Response:

```json
{
  "engineVersion": "1.0.0",
  "result": {},
  "checks": [],
  "warnings": [],
  "audit": {}
}
```

FastAPI can later host exactly the same pure calculation model translated into Python, or the JS calculation engine can remain the browser implementation while Python handles project management and reporting. Do not introduce a backend merely to move arithmetic out of React; first achieve a clean deterministic domain engine.

---

# 56. Recommended long-term split

For an engineering product, the ideal target is:

```text
                    ┌─────────────────────┐
                    │ React 18 + MUI       │
                    │ UI / diagrams / PDF  │
                    └──────────┬──────────┘
                               │
                         Design API
                               │
              ┌────────────────┴────────────────┐
              │                                 │
      ┌───────▼────────┐              ┌────────▼────────┐
      │ Browser Engine  │              │ FastAPI Backend  │
      │ TypeScript      │              │ Python           │
      └───────┬────────┘              └────────┬─────────┘
              │                                │
              └────────── calculation ─────────┘
                               │
                     ┌─────────▼────────┐
                     │ Audit / Project  │
                     │ DB / Reports     │
                     └──────────────────┘
```

The first version can use only the browser path. The important requirement is that the calculation engine already has a stable domain contract.

---

# 57. Engineering principles that should be mandatory

## Principle 1 — No engineering formula in JSX

Bad:

```jsx
const Mc = 0.85 * fc * b * d * d;
```

Good:

```ts
const sectionResult = calculateSectionCapacity(input);
```

## Principle 2 — No hidden engineering constants

Bad:

```ts
const shearKey = 0.15 * steelCapacity;
```

Good:

```ts
const shearKey = calculateShearKeyCapacity({
  geometry,
  material,
  connectionType,
  codeBasis
});
```

## Principle 3 — No duplicated formula implementations

One N-M solver only.

One effective-EI calculation only.

One seismic parts calculator only.

One P-Delta solver only.

## Principle 4 — Calculation outputs carry traceability

Every important result must answer:

```text
What was calculated?
What equation was used?
What assumptions were used?
Which standard/clause supports it?
What units are used?
What check does it feed?
```

## Principle 5 — Scope limits are part of the design

The program must be able to say:

```text
OUT OF SCOPE — BRANZ slender-panel method
```

rather than producing a plausible-looking number.

## Principle 6 — Separate structural demand, resistance and detailing

```text
Demand
  ≠
Capacity
  ≠
Detailing
  ≠
Connection capacity
  ≠
Foundation capacity
```

## Principle 7 — Use engineering result objects everywhere

The UI, chart and report should all consume the same calculation-result source.

---

# 58. Recommended development order for the current PCP repository

If using an AI coding agent against the repository, use exactly this sequence:

```text
1. Audit repository.
2. Freeze legacy outputs.
3. Add TypeScript domain model.
4. Add code-basis registry.
5. Add units and numerical utilities.
6. Extract action combinations.
7. Extract section mechanics.
8. Replace N-M implementation.
9. Rebuild in-plane design.
10. Rebuild OOP design.
11. Implement dedicated BRANZ stability engine.
12. Rebuild base connection.
13. Rebuild eaves connection.
14. Rebuild foundation interface.
15. Add SLS/serviceability.
16. Create unified DesignResult.
17. Create ReportModel.
18. Refactor MUI UI.
19. Refactor charts and SVG diagrams.
20. Add full benchmark suite.
21. Perform independent engineering QA.
22. Switch production default to new engine.
```

---

# 59. Critical engineering review items for the existing PCP before accepting the new engine

The following items should be specifically checked rather than assumed correct:

1. Whether the current generic support moment coefficients are appropriate for each actual panel support case.
2. Whether the current OOP earthquake loading correctly distinguishes building-level lateral action from NZS 1170.5 Part/Component action.
3. Whether the use of BRANZ `k` has been correctly separated from a generic effective-length factor.
4. Whether effective stiffness is consistent between ULS, SLS and stability calculations.
5. Whether P-Delta is iterated to convergence and whether non-convergence is surfaced.
6. Whether the low-axial-load limit from BRANZ is actively enforced as a method-domain check.
7. Whether reinforcement limits from NZS 3101 are applied consistently to single-layer slender panels.
8. Whether anchorage/development is checked according to the actual connection geometry.
9. Whether eaves connection demands include the appropriate seismic/roof flexibility effects.
10. Whether footing uplift is handled through partial contact equilibrium rather than simply rejecting negative `qmin`.
11. Whether connection capacities include all actual failure modes rather than only steel strength.
12. Whether load combinations are generated centrally.
13. Whether all report values are generated from the same calculation result as the screen UI.
14. Whether legacy and new engines can be compared automatically during migration.

---

# 60. Final target architecture summary

The finished PCP application should conceptually be:

```text
                    PCP PRECAST PANEL DESIGN

 ┌─────────────────────────────────────────────────────────────┐
 │                    REACT 18 + MUI                          │
 │                                                             │
 │ Inputs → Design Basis → Actions → Results → Calculation    │
 │                                    ↓                        │
 │                         Diagrams / Charts / Report          │
 └─────────────────────────────┬───────────────────────────────┘
                               │
                         typed DesignInput
                               │
 ┌─────────────────────────────▼───────────────────────────────┐
 │                  PURE ENGINEERING ENGINE                   │
 │                                                             │
 │  Code Basis                                                 │
 │      ↓                                                      │
 │  Actions / combinations                                     │
 │      ↓                                                      │
 │  Section mechanics / N-M                                    │
 │      ↓                                                      │
 │  In-plane                                                    │
 │      ↓                                                      │
 │  OOP + effective EI + P-Δ                                    │
 │      ↓                                                      │
 │  BRANZ stability                                             │
 │      ↓                                                      │
 │  Connections                                                 │
 │      ↓                                                      │
 │  Foundation                                                  │
 │      ↓                                                      │
 │  Serviceability                                              │
 └─────────────────────────────┬───────────────────────────────┘
                               │
                         DesignResult
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
       Results UI          Charts/Diagrams       ReportModel
                                                     │
                                                     ▼
                                               PDF / Print
```

The essential architectural change is therefore not simply “split a large JS file.” It is to establish a **single engineering source of truth** with explicit code basis, scope limits, unit consistency, deterministic numerical solvers, traceable calculations and reusable result objects. React/MUI becomes the presentation and user-interaction layer on top of that engine.

---

# 61. Sources and technical references

Primary references used to define this architecture:

- BRANZ, G. J. Beattie (2007), *Design Guide — Slender Precast Concrete Panels with Low Axial Load*.
- Standards New Zealand, NZS 3101.1&2:2006, including Amendment 3.
- Standards New Zealand / Standards Australia, AS/NZS 1170.0:2002.
- Standards New Zealand / Standards Australia, AS/NZS 1170.1:2002.
- Standards New Zealand / Standards Australia, AS/NZS 1170.2:2021.
- Standards New Zealand, NZS 1170.5:2004 and its commentary.
- NZ Building Code / B1 structural requirements and related verification pathway.

Useful technical themes from the BRANZ guide that directly influence this software architecture include:

- limited low-axial-load domain;
- slender wall geometry and support assumptions;
- reinforcement/detailing limits;
- structural ductility choices;
- effective stiffness;
- in-plane load distribution;
- effective wall-height/fixity factor `k`;
- out-of-plane stability;
- foundation connection design;
- eaves connection forces;
- seismic loading of the panel as a building part;
- example calculation and stability methods.

---

# 62. Deliverable checklist for AI agents

Before accepting a coding-agent PR, verify:

```text
[ ] No engineering formula added to JSX.
[ ] No duplicate N-M solver exists.
[ ] No duplicate P-Delta solver exists.
[ ] No unexplained engineering coefficient exists.
[ ] Every code-derived coefficient has a source reference.
[ ] Code edition is explicit.
[ ] NZS 1170.5:2004 is not silently replaced.
[ ] BRANZ applicability is checked.
[ ] Units are explicit.
[ ] Numerical convergence is explicit.
[ ] Calculation results are deterministic.
[ ] Report does not recalculate values.
[ ] Charts do not recalculate values.
[ ] Foundation partial-contact logic is explicit.
[ ] Connection failure modes are explicit.
[ ] Legacy regression suite passes.
[ ] BRANZ benchmark suite passes.
[ ] Invalid input tests pass.
[ ] Out-of-scope tests pass.
[ ] MUI components use the shared theme.
[ ] UI state does not leak into engineering calculations.
[ ] Engineering QA review is documented.
```

---

## End of specification
