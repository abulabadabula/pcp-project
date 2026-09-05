// src/domain/codeBasis/registry.ts

export interface CodeReference {
  id: string;
  standard: string;
  edition: string;
  clause?: string;
  table?: string;
  equation?: string;
  description: string;
  applicability?: string;
}

// ==========================================
// NZS 3101:2006 (Concrete Structures)
// ==========================================
export const NZS3101 = {
  GENERAL: {
    PHI_FACTOR: {
      id: 'NZS3101-2.3',
      standard: 'NZS 3101.1',
      edition: '2006+A3',
      clause: '2.3',
      description: 'Capacity reduction factors (phi)',
      applicability: 'All ULS checks'
    } as CodeReference,
  },
  SECTION: {
    STRESS_BLOCK: {
      id: 'NZS3101-10.3',
      standard: 'NZS 3101.1',
      edition: '2006+A3',
      clause: '10.3',
      description: 'Rectangular stress block parameters (alpha1, beta1, gamma)',
      applicability: 'Flexure and axial load'
    } as CodeReference,
    STRAIN_COMPAT: {
      id: 'NZS3101-10.2',
      standard: 'NZS 3101.1',
      edition: '2006+A3',
      clause: '10.2',
      description: 'Strain compatibility and plane sections remain plane',
      applicability: 'N-M interaction solver'
    } as CodeReference,
  },
  WALLS: {
    MIN_THICKNESS: {
      id: 'NZS3101-11.4.1',
      standard: 'NZS 3101.1',
      edition: '2006+A3',
      clause: '11.4.1',
      description: 'Minimum wall thickness (100mm or L/25)',
      applicability: 'Geometry validation'
    } as CodeReference,
    SHEAR_STRENGTH: {
      id: 'NZS3101-11.5',
      standard: 'NZS 3101.1',
      edition: '2006+A3',
      clause: '11.5',
      description: 'In-plane shear strength of walls',
      applicability: 'In-plane shear check'
    } as CodeReference,
    DETAILING: {
      id: 'NZS3101-11.6',
      standard: 'NZS 3101.1',
      edition: '2006+A3',
      clause: '11.6',
      description: 'Wall reinforcement detailing and spacing limits',
      applicability: 'Detailing checks'
    } as CodeReference,
    BOUNDARY_ELEMENT: {
      id: 'NZS3101-11.7',
      standard: 'NZS 3101.1',
      edition: '2006+A3',
      clause: '11.7',
      description: 'Boundary elements for structural walls',
      applicability: 'Ductile wall design'
    } as CodeReference,
  },
  FOUNDATION: {
    BEARING: {
      id: 'NZS3101-12.6',
      standard: 'NZS 3101.1',
      edition: '2006+A3',
      clause: '12.6',
      description: 'Bearing strength of concrete',
      applicability: 'Foundation interface'
    } as CodeReference,
  },
  CONNECTIONS: {
    SHEAR_FRICTION: {
      id: 'NZS3101-17.5',
      standard: 'NZS 3101.1',
      edition: '2006+A3',
      clause: '17.5',
      description: 'Shear friction design',
      applicability: 'Base and horizontal joints'
    } as CodeReference,
  }
};

// ==========================================
// AS/NZS 1170 Series (Loading)
// ==========================================
export const AS_NZS_1170 = {
  COMBINATIONS: {
    ULS: {
      id: 'AS1170.0-3.2',
      standard: 'AS/NZS 1170.0',
      edition: '2002',
      clause: '3.2',
      description: 'ULS load combinations',
      applicability: 'All ULS checks'
    } as CodeReference,
    SLS: {
      id: 'AS1170.0-3.4',
      standard: 'AS/NZS 1170.0',
      edition: '2002',
      clause: '3.4',
      description: 'SLS load combinations',
      applicability: 'Serviceability checks'
    } as CodeReference,
  },
  SEISMIC_PARTS: {
    FP_FORMULA: {
      id: 'NZS1170.5-8.3',
      standard: 'NZS 1170.5',
      edition: '2004',
      clause: '8.3',
      equation: 'F_p = C_p(T_p) * C_ph * R_p * Z * W_p',
      description: 'Seismic design of parts and components',
      applicability: 'OOP seismic demand'
    } as CodeReference,
  }
};

// ==========================================
// BRANZ 2007 (Slender Precast Panels)
// ==========================================
export const BRANZ_2007 = {
  SCOPE: {
    HT_LIMIT: {
      id: 'BRANZ2007-Sec3',
      standard: 'BRANZ Slender Precast Concrete Panels',
      edition: '2007',
      clause: 'Section 3',
      description: 'Scope limitations: H/t <= 30 for slender panels',
      applicability: 'Method validity check'
    } as CodeReference,
    LOW_AXIAL: {
      id: 'BRANZ2007-Sec3.2',
      standard: 'BRANZ Slender Precast Concrete Panels',
      edition: '2007',
      clause: 'Section 3.2',
      description: 'Low axial load domain definition',
      applicability: 'Method validity check'
    } as CodeReference,
  },
  STABILITY: {
    EULER_STRUT: {
      id: 'BRANZ2007-Sec5',
      standard: 'BRANZ Slender Precast Concrete Panels',
      edition: '2007',
      clause: 'Section 5',
      description: 'Euler compression-strut stability approach',
      applicability: 'OOP stability check'
    } as CodeReference,
    VLASOV: {
      id: 'BRANZ2007-Sec5.4',
      standard: 'BRANZ Slender Precast Concrete Panels',
      edition: '2007',
      clause: 'Section 5.4',
      description: 'Vlasov/Timoshenko stability relationship',
      applicability: 'OOP stability check'
    } as CodeReference,
  },
  SERVICEABILITY: {
    DEFLECTION: {
      id: 'BRANZ2007-Sec7',
      standard: 'BRANZ Slender Precast Concrete Panels',
      edition: '2007',
      clause: 'Section 7',
      description: 'Serviceability deflection limits (e.g., H/400)',
      applicability: 'SLS OOP deflection'
    } as CodeReference,
  }
};

// Helper to get a reference by ID (useful for dynamic lookups)
export function getCodeReference(id: string): CodeReference | undefined {
  // In a real app, this would search a flattened map of all references
  return undefined; 
}