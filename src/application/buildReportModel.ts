// src/application/buildReportModel.ts

import { DesignInput, CheckResult, CalculationStep, Warning } from '../domain/model/types';
import { SectionCapacityResult } from '../engineering/section/nmInteraction';
import { PDeltaResult } from '../engineering/outOfPlane/pDelta';
import { PartialContactResult } from '../engineering/foundation/partialContact';

// 报告数据模型 (View Model for Report)
export interface DesignReportModel {
  projectInfo: {
    projectName: string;
    panelId: string;
    date: string;
    engineer: string;
  };
  designBasis: {
    standards: string[];
    softwareVersion: string;
    engineVersion: string;
  };
  inputSummary: {
    geometry: { width: number; height: number; thickness: number; units: string };
    materials: { fc: number; fy: number; units: string };
  };
  calculationSections: {
    title: string;
    steps: CalculationStep[];
  }[];
  checkSummary: {
    id: string;
    title: string;
    demand: number;
    capacity: number;
    utilisation: number;
    status: string;
    isGoverning: boolean;
  }[];
  governingCheck: {
    title: string;
    utilisation: number;
  } | null;
  overallStatus: 'PASS' | 'WARNING' | 'FAIL' | 'OUT_OF_SCOPE';
  warnings: Warning[];
}

export interface AggregatedDesignResult {
  sectionResults: SectionCapacityResult;
  pDeltaResults: PDeltaResult;
  foundationResults: PartialContactResult;
  // ... other module results
  allChecks: CheckResult[];
  allSteps: CalculationStep[];
  warnings: Warning[];
}

export function buildReportModel(
  input: DesignInput, 
  result: AggregatedDesignResult
): DesignReportModel {
  
  // 1. 提取所有检查结果并寻找控制工况 (Governing Check)
  const validChecks = result.allChecks.filter(c => c.status !== 'NOT_CHECKED');
  const governingCheck = validChecks.reduce((max, check) => 
    check.utilisation > max.utilisation ? check : max
  , validChecks[0]);

  // 2. 确定整体状态
  let overallStatus: 'PASS' | 'WARNING' | 'FAIL' | 'OUT_OF_SCOPE' = 'PASS';
  if (validChecks.some(c => c.status === 'OUT_OF_SCOPE')) overallStatus = 'OUT_OF_SCOPE';
  else if (validChecks.some(c => c.status === 'FAIL')) overallStatus = 'FAIL';
  else if (validChecks.some(c => c.status === 'WARNING')) overallStatus = 'WARNING';

  // 3. 组装报告章节 (按工程逻辑排序)
  const calculationSections = [
    { title: '1. Section Properties & N-M Interaction', steps: result.sectionResults.steps },
    { title: '2. Out-of-Plane P-Delta Analysis', steps: result.pDeltaResults.steps },
    { title: '3. Foundation Interface & Bearing', steps: result.foundationResults.steps },
    // ... add other sections
  ];

  // 4. 映射检查结果为报告格式
  const checkSummary = validChecks.map(c => ({
    id: c.id,
    title: c.title,
    demand: c.demand,
    capacity: c.capacity,
    utilisation: c.utilisation,
    status: c.status,
    isGoverning: governingCheck && c.id === governingCheck.id
  }));

  return {
    projectInfo: {
      projectName: input.projectId, // Placeholder
      panelId: 'WP-01',
      date: new Date().toISOString().split('T')[0],
      engineer: 'Design Engineer'
    },
    designBasis: {
      standards: ['NZS 3101:2006', 'AS/NZS 1170.0:2002', 'NZS 1170.5:2004', 'BRANZ 2007'],
      softwareVersion: '1.0.0',
      engineVersion: '1.0.0'
    },
    inputSummary: {
      geometry: { ...input.geometry, units: 'mm' },
      materials: { fc: input.concrete.fc, fy: input.reinforcement[0]?.fy || 500, units: 'MPa' },
    },
    calculationSections,
    checkSummary,
    governingCheck: governingCheck ? { title: governingCheck.title, utilisation: governingCheck.utilisation } : null,
    overallStatus,
    warnings: result.warnings
  };
}