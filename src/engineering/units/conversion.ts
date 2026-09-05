// src/engineering/units/conversion.ts

export const UnitConverter = {
  // Length
  mmToM: (mm: number): number => mm / 1000,
  mToMm: (m: number): number => m * 1000,

  // Force
  kNToN: (kN: number): number => kN * 1000,
  NToKN: (N: number): number => N / 1000,

  // Moment
  kNmToNmm: (kNm: number): number => kNm * 1e6,
  nmmToKNm: (nmm: number): number => nmm / 1e6,

  // Stress / Pressure
  mpaToNPerMm2: (mpa: number): number => mpa, // 1 MPa = 1 N/mm²
  knPerM2ToMpa: (kPa: number): number => kPa / 1000, // 1 kPa = 0.001 MPa
  
  // Area
  mm2ToM2: (mm2: number): number => mm2 / 1e6,
};