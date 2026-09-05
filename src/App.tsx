// import React from 'react'
// import { Container, Typography, Box, Paper } from '@mui/material'
// import { SectionNMEngine } from './engineering/section/nmInteraction'
// import { PDeltaEngine } from './engineering/outOfPlane/pDelta'
// import { BranzStabilityEngine } from './engineering/outOfPlane/branzStability'
// import { FoundationInterfaceEngine } from './engineering/foundation/partialContact'

// function App() {
//   // 演示：在控制台运行核心引擎测试
//   React.useEffect(() => {
//     console.log('🚀 PCP Engine Initialized. Running smoke tests...');
    
//     // 1. Section N-M Engine
//     const nmEngine = new SectionNMEngine({
//       projectId: 'DEMO-01',
//       geometry: { width: 1000, height: 3000, thickness: 150 },
//       concrete: { fc: 30, density: 2400 },
//       reinforcement: [{ id: 'L1', locationFromCompressionFace: 120, area: 628, fy: 500, Es: 200000 }],
//       phiFactor: 0.85
//     });
//     const nmResult = nmEngine.generateNMInteractionCurve();
//     console.log('✅ N-M Curve generated. Pure Bending φM:', nmResult.phiM.toFixed(2), 'kNm');

//     // 2. Foundation Partial Contact
//     const foundEngine = new FoundationInterfaceEngine();
//     const foundResult = foundEngine.analyze({
//       N_star_kN: 100, M_star_kNm: 5, width_mm: 1000, thickness_mm: 150, q_allowable_kPa: 300
//     });
//     console.log('✅ Foundation analyzed. Partial Contact:', foundResult.isPartialContact, '| q_max:', foundResult.q_max_kPa.toFixed(1), 'kPa');
    
//   }, []);

//   return (
//     <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
//       <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
//         <Typography variant="h4" component="h1" gutterBottom color="primary" fontWeight="bold">
//           PCP Design Engine
//         </Typography>
//         <Typography variant="subtitle1" color="text.secondary" gutterBottom>
//           New Zealand Precast Concrete Panel Design Software
//         </Typography>
        
//         <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.9rem' }}>
//           <Typography variant="body2">
//             🟢 Core Engine Loaded. Open the <strong>Browser Console (F12)</strong> to see the calculation smoke tests.
//           </Typography>
//           <Typography variant="body2" sx={{ mt: 1 }}>
//             📐 Modules Active: <code>SectionNM</code>, <code>PDelta</code>, <code>BRANZ Stability</code>, <code>Foundation Partial Contact</code>.
//           </Typography>
//         </Box>

//         <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
//           Next step: Wire up the MUI forms in <code>src/features/precast-panel/</code> to feed data into these engines.
//         </Typography>
//       </Paper>
//     </Container>
//   )
// }

// export default App


// src/App.tsx
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme/theme';
import PrecastPanelDashboard from './features/precast-panel/PrecastPanelDashboard';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PrecastPanelDashboard />
    </ThemeProvider>
  );
}

export default App;