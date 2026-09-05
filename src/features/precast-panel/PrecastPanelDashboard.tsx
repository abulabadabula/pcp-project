// src/features/precast-panel/PrecastPanelDashboard.tsx
import React, { useState } from 'react';
import { 
  Container, Typography, Grid, Paper, TextField, Button, 
  Box, Divider, Alert 
} from '@mui/material';
import { SectionNMEngine } from '../../engineering/section/nmInteraction';
import { FoundationInterfaceEngine } from '../../engineering/foundation/partialContact';
import { ResultsSummaryCard } from './components/ResultsSummaryCard';
import { DesignReportModel } from '../../application/buildReportModel';

interface FormState {
  width: number;
  height: number;
  thickness: number;
  fc: number;
  N_star: number;
  M_star: number;
}

export const PrecastPanelDashboard: React.FC = () => {
  const [form, setForm] = useState<FormState>({
    width: 1000,
    height: 3000,
    thickness: 150,
    fc: 30,
    N_star: 100,
    M_star: 5
  });

  const [report, setReport] = useState<DesignReportModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: Number(e.target.value) });
  };

  const handleCalculate = () => {
    try {
      setError(null);
      
      // 1. 运行截面 N-M 引擎
      const nmEngine = new SectionNMEngine({
        projectId: 'USER-01',
        geometry: { width: form.width, height: form.height, thickness: form.thickness },
        concrete: { fc: form.fc, density: 2400 },
        reinforcement: [{ id: 'L1', locationFromCompressionFace: form.thickness - 30, area: 628, fy: 500, Es: 200000 }],
        phiFactor: 0.85
      });
      const nmResult = nmEngine.generateNMInteractionCurve();

      // 2. 运行基础局部接触引擎
      const foundEngine = new FoundationInterfaceEngine();
      const foundResult = foundEngine.analyze({
        N_star_kN: form.N_star,
        M_star_kNm: form.M_star,
        width_mm: form.width,
        thickness_mm: form.thickness,
        q_allowable_kPa: 300
      });

      // 3. 构建严格符合 DesignReportModel 接口的报告对象
      const foundationUtilisation = foundResult.q_max_kPa / 300;
      const nmUtilisation = form.M_star / nmResult.phiM;
      const isFoundationGoverning = foundationUtilisation > nmUtilisation;

      const mockReport: DesignReportModel = {
        projectInfo: {
          projectName: "Demo Precast Project",
          panelId: "PANEL-001",
          date: new Date().toISOString().split('T')[0],
          engineer: "Structural Engineer"
        },
        designBasis: {
          standards: ["NZS 3101:2006"],
          softwareVersion: "1.0.0",
          engineVersion: "1.0.0"
        },
        inputSummary: {
          geometry: { width: form.width, height: form.height, thickness: form.thickness, units: "mm" },
          materials: { fc: form.fc, fy: 500, units: "MPa" }
        },
        calculationSections: [], // 后续可扩展详细计算步骤
        checkSummary: [
          {
            id: "check-foundation",
            title: "Foundation Bearing Pressure",
            demand: foundResult.q_max_kPa,
            capacity: 300,
            utilisation: foundationUtilisation,
            status: foundationUtilisation <= 1.0 ? "PASS" : "FAIL",
            isGoverning: isFoundationGoverning
          },
          {
            id: "check-nm",
            title: "N-M Interaction (Pure Bending)",
            demand: form.M_star,
            capacity: nmResult.phiM,
            utilisation: nmUtilisation,
            status: nmUtilisation <= 1.0 ? "PASS" : "FAIL",
            isGoverning: !isFoundationGoverning
          }
        ],
        governingCheck: isFoundationGoverning 
          ? { title: "Foundation Bearing Pressure", utilisation: foundationUtilisation }
          : { title: "N-M Interaction (Pure Bending)", utilisation: nmUtilisation },
        overallStatus: (foundationUtilisation <= 1.0 && nmUtilisation <= 1.0) ? "PASS" : "FAIL",
        warnings: []
      };

      setReport(mockReport);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '计算过程中发生未知错误，请检查输入值是否合理');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom color="primary" fontWeight="bold">
        NZ Precast Concrete Panel Design
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        基于 NZS 3101 的预制混凝土墙板截面与基础验算工具
      </Typography>

      <Grid container spacing={3}>
        {/* 左侧：输入表单 */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Design Parameters</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box component="form" noValidate autoComplete="off">
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>Geometry (mm)</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Width" type="number" value={form.width} onChange={handleInputChange('width')} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Thickness" type="number" value={form.thickness} onChange={handleInputChange('thickness')} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Height" type="number" value={form.height} onChange={handleInputChange('height')} />
                </Grid>
              </Grid>

              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, color: 'text.secondary' }}>Material & Loads</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="f'c (MPa)" type="number" value={form.fc} onChange={handleInputChange('fc')} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="N* (kN)" type="number" value={form.N_star} onChange={handleInputChange('N_star')} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="M* (kNm)" type="number" value={form.M_star} onChange={handleInputChange('M_star')} />
                </Grid>
              </Grid>

              <Button 
                variant="contained" 
                color="primary" 
                fullWidth 
                sx={{ mt: 3, py: 1.5, fontWeight: 'bold' }}
                onClick={handleCalculate}
              >
                Run Design Check
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* 右侧：结果展示 */}
        <Grid item xs={12} md={8}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          {!report ? (
            <Paper elevation={1} sx={{ p: 5, textAlign: 'center', bgcolor: 'grey.50', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                请在左侧输入参数并点击 "Run Design Check" 查看计算结果。
              </Typography>
            </Paper>
          ) : (
            <Box>
              {/* 现在传入的数据结构完全匹配 ResultsSummaryCard 的要求 */}
              <ResultsSummaryCard reportModel={report} />
              
              <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
                <Typography variant="h6" gutterBottom>Engineering Notes</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  • N-M interaction calculated with φ = 0.85 (NZS 3101 default for walls).<br/>
                  • Foundation check assumes rigid base and linear soil pressure distribution.<br/>
                  • Partial contact is flagged if tension develops or q_max exceeds allowable (300 kPa).
                </Typography>
              </Paper>
            </Box>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default PrecastPanelDashboard;