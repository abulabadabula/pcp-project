// src/features/precast-panel/charts/OOPDeflectionDiagram.tsx

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';

export interface OOPDeflectionData {
  height_mm: number;
  deflectionShape: { y_mm: number; delta_mm: number }[]; // y from base, delta = lateral displacement
  deltaMax_mm: number;
  limit_mm: number;
  supportBase: 'pinned' | 'fixed';
  supportTop: 'pinned' | 'fixed' | 'free';
}

interface OOPDeflectionDiagramProps {
  data: OOPDeflectionData;
  width?: number;
  height?: number;
}

export const OOPDeflectionDiagram: React.FC<OOPDeflectionDiagramProps> = ({
  data,
  width = 300,
  height = 450,
}) => {
  const theme = useTheme();
  const margin = { top: 30, right: 40, bottom: 40, left: 50 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const maxDelta = Math.max(data.deltaMax_mm, data.limit_mm) * 1.3;
  const scaleY = (y: number) => margin.top + plotH - (y / data.height_mm) * plotH;
  const scaleX = (d: number) => margin.left + (d / maxDelta) * plotW;

  const pathD = data.deflectionShape
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${scaleX(pt.delta_mm).toFixed(1)},${scaleY(pt.y_mm).toFixed(1)}`)
    .join(' ');

  const limitX = scaleX(data.limit_mm);

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="subtitle2" gutterBottom>
        Out-of-Plane Deflection Shape
      </Typography>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ fontFamily: theme.typography.fontFamily }}>
        {/* Undeformed panel (vertical line) */}
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="#999" strokeWidth={1} strokeDasharray="4,4" />

        {/* Deflection limit line */}
        <line x1={limitX} y1={margin.top} x2={limitX} y2={margin.top + plotH} stroke={theme.palette.warning.main} strokeWidth={1} strokeDasharray="3,3" />
        <text x={limitX + 3} y={margin.top + 12} fontSize={9} fill={theme.palette.warning.main}>H/{(data.height_mm / data.limit_mm).toFixed(0)} limit</text>

        {/* Deformed shape */}
        <path d={pathD} fill="none" stroke={theme.palette.primary.main} strokeWidth={2.5} />

        {/* Panel thickness representation at base and top */}
        <rect x={margin.left - 8} y={scaleY(0) - 2} width={16} height={4} fill="#666" />
        <rect x={margin.left - 8} y={scaleY(data.height_mm) - 2} width={16} height={4} fill="#666" />

        {/* Max deflection annotation */}
        <line x1={margin.left} y1={scaleY(data.height_mm / 2)} x2={scaleX(data.deltaMax_mm)} y2={scaleY(data.height_mm / 2)} stroke={theme.palette.error.main} strokeWidth={1} markerEnd="url(#arrow)" />
        <text x={scaleX(data.deltaMax_mm) + 4} y={scaleY(data.height_mm / 2) + 4} fontSize={10} fill={theme.palette.error.main} fontWeight="bold">
          Δ = {data.deltaMax_mm.toFixed(1)} mm
        </text>

        {/* Axes */}
        <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="#333" strokeWidth={1} />
        <text x={margin.left + plotW / 2} y={height - 5} textAnchor="middle" fontSize={11}>Deflection δ (mm)</text>

        {/* Height labels */}
        <text x={margin.left - 8} y={scaleY(0) + 4} textAnchor="end" fontSize={9}>0</text>
        <text x={margin.left - 8} y={scaleY(data.height_mm) + 4} textAnchor="end" fontSize={9}>{(data.height_mm / 1000).toFixed(1)}m</text>

        {/* Support symbols */}
        {data.supportBase === 'pinned' && (
          <polygon points={`${margin.left - 8},${scaleY(0) + 4} ${margin.left + 8},${scaleY(0) + 4} ${margin.left},${scaleY(0) + 14}`} fill="#666" />
        )}
        {data.supportBase === 'fixed' && (
          <rect x={margin.left - 10} y={scaleY(0) + 2} width={20} height={6} fill="#666" />
        )}

        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={theme.palette.error.main} />
          </marker>
        </defs>
      </svg>
    </Box>
  );
};