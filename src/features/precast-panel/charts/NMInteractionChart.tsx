// src/features/precast-panel/charts/NMInteractionChart.tsx

import React, { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { NMInteractionPoint } from '../../../domain/model/types';

export interface NMChartData {
  curveNominal: NMInteractionPoint[];
  curveDesign: NMInteractionPoint[];
  demandPoints: { N: number; M: number; label: string; id: string }[];
  keyPoints: { N: number; M: number; label: string }[];
}

interface NMInteractionChartProps {
  data: NMChartData;
  width?: number;
  height?: number;
}

export const NMInteractionChart: React.FC<NMInteractionChartProps> = ({
  data,
  width = 500,
  height = 450,
}) => {
  const theme = useTheme();
  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Compute axis scales from data — this is VIEW logic, not engineering logic
  const { xMax, yMax, xMin, yMin } = useMemo(() => {
    const allPts = [...data.curveNominal, ...data.curveDesign, ...data.demandPoints];
    const ms = allPts.map(p => p.M);
    const ns = allPts.map(p => p.N);
    return {
      xMax: Math.max(...ms) * 1.15,
      xMin: Math.min(0, Math.min(...ms)) * 1.15,
      yMax: Math.max(...ns) * 1.1,
      yMin: Math.min(0, Math.min(...ns)) * 1.1,
    };
  }, [data]);

  const scaleX = (m: number) => margin.left + ((m - xMin) / (xMax - xMin)) * plotW;
  const scaleY = (n: number) => margin.top + plotH - ((n - yMin) / (yMax - yMin)) * plotH;

  const toPath = (pts: NMInteractionPoint[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(p.M).toFixed(1)},${scaleY(p.N).toFixed(1)}`).join(' ');

  // Grid lines
  const xTicks = Array.from({ length: 6 }, (_, i) => xMin + (i / 5) * (xMax - xMin));
  const yTicks = Array.from({ length: 6 }, (_, i) => yMin + (i / 5) * (yMax - yMin));

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="subtitle2" gutterBottom>
        N–M Interaction Diagram
      </Typography>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ fontFamily: theme.typography.fontFamily }}>
        {/* Grid */}
        {xTicks.map((v, i) => (
          <g key={`xg-${i}`}>
            <line x1={scaleX(v)} y1={margin.top} x2={scaleX(v)} y2={margin.top + plotH} stroke="#e0e0e0" strokeWidth={0.5} />
            <text x={scaleX(v)} y={height - 10} textAnchor="middle" fontSize={10} fill="#666">{v.toFixed(0)}</text>
          </g>
        ))}
        {yTicks.map((v, i) => (
          <g key={`yg-${i}`}>
            <line x1={margin.left} y1={scaleY(v)} x2={margin.left + plotW} y2={scaleY(v)} stroke="#e0e0e0" strokeWidth={0.5} />
            <text x={margin.left - 8} y={scaleY(v) + 3} textAnchor="end" fontSize={10} fill="#666">{v.toFixed(0)}</text>
          </g>
        ))}

        {/* Axes */}
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="#333" strokeWidth={1.5} />
        <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="#333" strokeWidth={1.5} />

        {/* Axis labels */}
        <text x={margin.left + plotW / 2} y={height - 0} textAnchor="middle" fontSize={12} fontWeight="bold">Moment M (kN·m)</text>
        <text x={14} y={margin.top + plotH / 2} textAnchor="middle" fontSize={12} fontWeight="bold" transform={`rotate(-90,14,${margin.top + plotH / 2})`}>Axial N (kN)</text>

        {/* Nominal curve */}
        {data.curveNominal.length > 1 && (
          <path d={toPath(data.curveNominal)} fill="none" stroke={theme.palette.grey[500]} strokeWidth={1.5} strokeDasharray="6,3" />
        )}

        {/* Design curve (φ applied) */}
        {data.curveDesign.length > 1 && (
          <path d={toPath(data.curveDesign)} fill="none" stroke={theme.palette.primary.main} strokeWidth={2.5} />
        )}

        {/* Key points */}
        {data.keyPoints.map((pt, i) => (
          <g key={`kp-${i}`}>
            <circle cx={scaleX(pt.M)} cy={scaleY(pt.N)} r={4} fill={theme.palette.primary.dark} />
            <text x={scaleX(pt.M) + 8} y={scaleY(pt.N) - 6} fontSize={9} fill="#333">{pt.label}</text>
          </g>
        ))}

        {/* Demand points */}
        {data.demandPoints.map((pt, i) => (
          <g key={`dp-${i}`}>
            <polygon
              points={`${scaleX(pt.M)},${scaleY(pt.N) - 6} ${scaleX(pt.M) - 5},${scaleY(pt.N) + 4} ${scaleX(pt.M) + 5},${scaleY(pt.N) + 4}`}
              fill={theme.palette.error.main}
            />
            <text x={scaleX(pt.M) + 8} y={scaleY(pt.N) + 4} fontSize={9} fill={theme.palette.error.main} fontWeight="bold">{pt.label}</text>
          </g>
        ))}

        {/* Legend */}
        <g transform={`translate(${margin.left + 10},${margin.top + 10})`}>
          <line x1={0} y1={0} x2={20} y2={0} stroke={theme.palette.primary.main} strokeWidth={2.5} />
          <text x={25} y={4} fontSize={10}>Design (φN, φM)</text>
          <line x1={0} y1={16} x2={20} y2={16} stroke={theme.palette.grey[500]} strokeWidth={1.5} strokeDasharray="6,3" />
          <text x={25} y={20} fontSize={10}>Nominal (Nn, Mn)</text>
          <polygon points="10,28 5,38 15,38" fill={theme.palette.error.main} />
          <text x={25} y={36} fontSize={10}>Demand (N*, M*)</text>
        </g>
      </svg>
    </Box>
  );
};