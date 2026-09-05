// src/features/precast-panel/components/ResultsSummaryCard.tsx

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  LinearProgress,
  Paper
} from '@mui/material';
import { DesignReportModel } from '../../../application/buildReportModel';

interface ResultsSummaryCardProps {
  reportModel: DesignReportModel;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PASS': return 'success';
    case 'WARNING': return 'warning';
    case 'FAIL': return 'error';
    case 'OUT_OF_SCOPE': return 'default';
    default: return 'default';
  }
};

export const ResultsSummaryCard: React.FC<ResultsSummaryCardProps> = ({ reportModel }) => {
  const { overallStatus, governingCheck, checkSummary } = reportModel;

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Design Results Summary
        </Typography>

        {/* Overall Status Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Chip 
            label={overallStatus} 
            color={getStatusColor(overallStatus) as any} 
            size="medium" 
            sx={{ mr: 2, fontWeight: 'bold', fontSize: '1rem' }}
          />
          {governingCheck && (
            <Typography variant="body2">
              Governing Check: <strong>{governingCheck.title}</strong> (Utilisation: {(governingCheck.utilisation * 100).toFixed(1)}%)
            </Typography>
          )}
        </Box>

        {/* Checks Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="design checks table">
            <TableHead>
              <TableRow>
                <TableCell>Check Description</TableCell>
                <TableCell align="right">Demand</TableCell>
                <TableCell align="right">Capacity</TableCell>
                <TableCell align="center">Utilisation</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {checkSummary.map((check) => (
                <TableRow 
                  key={check.id} 
                  sx={{ 
                    '&:last-child td, &:last-child th': { border: 0 },
                    bgcolor: check.isGoverning ? 'action.hover' : 'inherit',
                    fontWeight: check.isGoverning ? 'bold' : 'normal'
                  }}
                >
                  <TableCell component="th" scope="row">
                    {check.title}
                    {check.isGoverning && <Chip label="Governing" size="small" color="primary" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell align="right">{check.demand.toFixed(2)}</TableCell>
                  <TableCell align="right">{check.capacity.toFixed(2)}</TableCell>
                  <TableCell align="center" sx={{ minWidth: 150 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={Math.min(check.utilisation * 100, 100)} 
                          color={check.utilisation > 1.0 ? 'error' : check.utilisation > 0.85 ? 'warning' : 'success'}
                        />
                      </Box>
                      <Box sx={{ minWidth: 35 }}>
                        <Typography variant="body2" color="text.secondary">
                          {(check.utilisation * 100).toFixed(0)}%
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={check.status} 
                      color={getStatusColor(check.status) as any} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};