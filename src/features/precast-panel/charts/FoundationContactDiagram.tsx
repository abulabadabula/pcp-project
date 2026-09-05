// src/features/precast-panel/charts/FoundationContactDiagram.tsx

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';

export interface FoundationContactData {
  thickness_mm: number;
  isPartialContact: boolean;
  contactWidth_mm: number;
  qMax_kPa: number;
  qMin_kPa: number;
  eccentricity_mm: number;
  kernLimit_mm: number;
  N_star_kN: number;
  T_star_kN: number;
}

interface FoundationContactDiagramProps {
  data: FoundationContactData;
  width?: number;
  height?: number;
}

export const FoundationContactDiagram: React.FC<FoundationContactDiagramProps> = ({
  data,
  width = 450,
  height = 300,
}) => {
  const theme = useTheme();
  const margin = { top: 40, right: 30, bottom: 50, left: 30 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const t = data.thickness_mm;
  const scaleX = (x_mm: number) => margin.left + (x_mm / t) * plotW;
  const maxQ = Math.max(data.qMax_kPa, 1) * 1.2;
  const scaleY = (q: number) => margin.top + plotH - (q / maxQ) * plotH;

  const baseY = margin.top + plotH;

  // Build stress block polygon
  let stressPath = '';
  if (!data.isPartialContact) {
    // Trapezoidal: full width contact
    const left = data.eccentricity_mm > 0 ? 0 : 0; // compression edge
    stressPath = `M${scaleX(0)},${baseY} L${scaleX(0)},${scaleY(data.qMin_kPa)} L${scaleX(t)},${scaleY(data.qMax_kPa)} L${scaleX(t)},${baseY} Z`;
  } else {
    // Triangular: partial contact from compressed edge
    const contactStart = t - data.contactWidth_mm; // compression at far edge from tension side
    stressPath = `M${scaleX(contactStart)},${baseY} L${scaleX(t)},${scaleY(data.qMax_kPa)} L${scaleX(t)},${baseY} Z`;
  }

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="subtitle2" gutterBottom>
        Base Bearing Pressure Distribution
      </Typography>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ fontFamily: theme.typography.fontFamily }}>
        {/* Panel cross-section outline */}
        <rect x={scaleX(0)} y={baseY - 30} width={plotW} height={30} fill="none" stroke="#333" strokeWidth={1.5} />
        <text x={scaleX(t / 2)} y={baseY - 12} textAnchor="middle" fontSize={10}>Panel Section</text>

        {/* Kern limits */}
        <line x1={scaleX(t / 2 - data.kernLimit_mm)} y1={margin.top} x2={scaleX(t / 2 - data.kernLimit_mm)} y2={baseY} stroke="#aaa" strokeWidth={0.5} strokeDasharray="3,3" />
        <line x1={scaleX(t / 2 + data.kernLimit_mm)} y1={margin.top} x2={scaleX(t / 2 + data.kernLimit_mm)} y2={baseY} stroke="#aaa" strokeWidth={0.5} strokeDasharray="3,3" />
        <text x={scaleX(t / 2 - data.kernLimit_mm)} y={margin.top - 5} textAnchor="middle" fontSize={8} fill="#999">-t/6</text>
        <text x={scaleX(t / 2 + data.kernLimit_mm)} y={margin.top - 5} textAnchor="middle" fontSize={8} fill="#999">+t/6</text>

        {/* Eccentricity marker */}
        <line x1={scaleX(t / 2)} y1={baseY - 30} x2={scaleX(t / 2 + data.eccentricity_mm)} y2={baseY - 45} stroke={theme.palette.error.main} strokeWidth={1.5} />
        <text x={scaleX(t / 2 + data.eccentricity_mm)} y={baseY - 48} textAnchor="middle" fontSize={9} fill={theme.palette.error.main}>e={data.eccentricity_mm.toFixed(0)}</text>

        {/* Stress block */}
        <path d={stressPath} fill={theme.palette.primary.light} fillOpacity={0.4} stroke={theme.palette.primary.main} strokeWidth={2} />

        {/* q_max label */}
        <text x={scaleX(t) + 5} y={scaleY(data.qMax_kPa) + 4} fontSize={10} fill={theme.palette.primary.dark} fontWeight="bold">
          q_max = {data.qMax_kPa.toFixed(1)} kPa
        </text>

        {/* Tension uplift arrow if partial contact */}
        {data.isPartialContact && data.T_star_kN > 0 && (
          <g>
            <line x1={scaleX(10)} y1={baseY - 30} x2={scaleX(10)} y2={baseY - 65} stroke={theme.palette.error.main} strokeWidth={2} markerEnd="url(#arrowUp)" />
            <text x={scaleX(10) + 5} y={baseY - 55} fontSize={9} fill={theme.palette.error.main}>T* = {data.T_star_kN.toFixed(1)} kN</text>
          </g>
        )}

        {/* Base line */}
        <line x1={margin.left} y1={baseY} x2={margin.left + plotW} y2={baseY} stroke="#333" strokeWidth={2} />

        {/* Dimension */}
        <line x1={scaleX(0)} y1={baseY + 15} x2={scaleX(t)} y2={baseY + 15} stroke="#333" strokeWidth={0.5} />
        <text x={scaleX(t / 2)} y={baseY + 28} textAnchor="middle" fontSize={10}>{t} mm</text>

        {/* Status label */}
        <text x={width / 2} y={15} textAnchor="middle" fontSize={11} fontWeight="bold" fill={data.isPartialContact ? theme.palette.warning.main : theme.palette.success.main}>
          {data.isPartialContact ? '⚠ PARTIAL CONTACT (Triangular)' : '✓ FULL CONTACT (Trapezoidal)'}
        </text>

        <defs>
          <marker id="arrowUp" markerWidth="6" markerHeight="6" refX="3" refY="6" orient="auto">
            <path d="M0,6 L3,0 L6,6 Z" fill={theme.palette.error.main} />
          </marker>
        </defs>
      </svg>
    </Box>
  );
};