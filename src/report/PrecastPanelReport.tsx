// src/report/PrecastPanelReport.tsx

import React from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Divider, Alert
} from '@mui/material';
import { DesignReportModel } from '../application/buildReportModel';

interface PrecastPanelReportProps {
  model: DesignReportModel;
}

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const colorMap: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    PASS: 'success', WARNING: 'warning', FAIL: 'error', OUT_OF_SCOPE: 'default',
  };
  return <Chip label={status} color={colorMap[status] || 'default'} size="small" variant="outlined" />;
};

export const PrecastPanelReport: React.FC<PrecastPanelReportProps> = ({ model }) => {
  return (
    <Box className="pcp-report" sx={{ p: 4, maxWidth: 900, mx: 'auto', '@media print': { p: 0 } }}>
      
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight="bold">Precast Concrete Panel</Typography>
        <Typography variant="h5">Engineering Design Report</Typography>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2">Project: {model.projectInfo.projectName} | Panel: {model.projectInfo.panelId}</Typography>
        <Typography variant="body2">Date: {model.projectInfo.date} | Engineer: {model.projectInfo.engineer}</Typography>
        <Typography variant="caption" color="text.secondary">
          Software v{model.designBasis.softwareVersion} | Engine v{model.designBasis.engineVersion}
        </Typography>
      </Box>

      {/* 1. Design Basis */}
      <Typography variant="h6" gutterBottom>1. Design Basis</Typography>
      <Box sx={{ mb: 2, pl: 2 }}>
        {model.designBasis.standards.map((s, i) => (
          <Typography key={i} variant="body2">• {s}</Typography>
        ))}
      </Box>

      {/* 2. Input Summary */}
      <Typography variant="h6" gutterBottom>2. Panel Geometry & Materials</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableBody>
            <TableRow><TableCell>Width</TableCell><TableCell>{model.inputSummary.geometry.width} {model.inputSummary.geometry.units}</TableCell></TableRow>
            <TableRow><TableCell>Height</TableCell><TableCell>{model.inputSummary.geometry.height} {model.inputSummary.geometry.units}</TableCell></TableRow>
            <TableRow><TableCell>Thickness</TableCell><TableCell>{model.inputSummary.geometry.thickness} {model.inputSummary.geometry.units}</TableCell></TableRow>
            <TableRow><TableCell>f'c</TableCell><TableCell>{model.inputSummary.materials.fc} {model.inputSummary.materials.units}</TableCell></TableRow>
            <TableRow><TableCell>fy</TableCell><TableCell>{model.inputSummary.materials.fy} {model.inputSummary.materials.units}</TableCell></TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* 3. Overall Result */}
      <Typography variant="h6" gutterBottom>3. Design Summary</Typography>
      <Alert severity={model.overallStatus === 'PASS' ? 'success' : model.overallStatus === 'FAIL' ? 'error' : 'warning'} sx={{ mb: 2 }}>
        <Typography variant="h6" component="span">Overall: {model.overallStatus}</Typography>
        {model.governingCheck && (
          <Typography variant="body2">
            {' '}— Governing: {model.governingCheck.title} (Utilisation: {(model.governingCheck.utilisation * 100).toFixed(1)}%)
          </Typography>
        )}
      </Alert>

      {/* 4. Check Summary Table */}
      <Typography variant="h6" gutterBottom>4. Design Checks</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Check</TableCell>
              <TableCell align="right">Demand</TableCell>
              <TableCell align="right">Capacity</TableCell>
              <TableCell align="right">Utilisation</TableCell>
              <TableCell align="center">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {model.checkSummary.map((c) => (
              <TableRow key={c.id} sx={{ bgcolor: c.isGoverning ? 'action.hover' : 'inherit' }}>
                <TableCell>
                  {c.title}
                  {c.isGoverning && <Chip label="GOVERNING" size="small" color="primary" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell align="right">{c.demand.toFixed(2)}</TableCell>
                <TableCell align="right">{c.capacity.toFixed(2)}</TableCell>
                <TableCell align="right">{(c.utilisation * 100).toFixed(1)}%</TableCell>
                <TableCell align="center"><StatusChip status={c.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 5. Detailed Calculation Steps */}
      <Typography variant="h6" gutterBottom>5. Detailed Calculations</Typography>
      {model.calculationSections.map((section, si) => (
        <Box key={si} sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold">{section.title}</Typography>
          {section.steps.map((step) => (
            <Box key={step.id} sx={{ mb: 2, pl: 2, borderLeft: '3px solid', borderColor: 'primary.light' }}>
              <Typography variant="subtitle2">{step.title}</Typography>
              {step.equation && (
                <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
                  {step.equation}
                </Typography>
              )}
              <Table size="small" sx={{ mt: 1 }}>
                <TableBody>
                  {Object.entries(step.variables || {}).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell sx={{ py: 0.5, fontWeight: 'medium' }}>{k}</TableCell>
                      <TableCell sx={{ py: 0.5 }} align="right">{typeof v === 'number' ? v.toFixed(4) : v}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ py: 0.5, fontWeight: 'bold' }}>Result</TableCell>
                    <TableCell sx={{ py: 0.5, fontWeight: 'bold' }} align="right">
                      {typeof step.result === 'number' ? step.result.toFixed(4) : step.result} {step.units}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              {step.source && step.source.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Ref: {step.source.map(s => `${s.standard} Cl.${s.clause}`).join(', ')}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      ))}

      {/* 6. Warnings */}
      {model.warnings.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>6. Warnings & Assumptions</Typography>
          {model.warnings.map((w, i) => (
            <Alert key={i} severity="warning" sx={{ mb: 1 }}>
              <Typography variant="body2"><strong>{w.title}:</strong> {w.message}</Typography>
              {w.source && <Typography variant="caption">Ref: {w.source.standard}</Typography>}
            </Alert>
          ))}
        </>
      )}

      {/* 7. Sign-off */}
      <Box sx={{ mt: 6, pt: 3, borderTop: '2px solid #333' }}>
        <Typography variant="h6">Engineer Sign-off</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Box>
            <Typography variant="body2">Designed by: ___________________</Typography>
            <Typography variant="body2">Date: ___________________</Typography>
          </Box>
          <Box>
            <Typography variant="body2">Reviewed by: ___________________</Typography>
            <Typography variant="body2">Date: ___________________</Typography>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          This report was generated by PCP Precast Panel Design Software v{model.designBasis.softwareVersion}.
          It is not a substitute for professional engineering judgement.
        </Typography>
      </Box>
    </Box>
  );
};