import { fitData, autoFit } from './fitting';

export const tinv = (_p: number, df: number): number => {
  if (df <= 0) return 0;
  if (df === 1) return 6.314;
  if (df === 2) return 2.920;
  if (df === 3) return 2.353;
  if (df === 4) return 2.132;
  if (df === 5) return 2.015;
  if (df > 30) return 1.645;
  return 1.7 + (2.0 - 1.7) * (1 / Math.sqrt(df));
};

export const calculateMean = (data: number[]): number => {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
};

export const calculateSD = (data: number[]): number => {
  if (data.length <= 1) return 0;
  const mean = calculateMean(data);
  const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (data.length - 1);
  return Math.sqrt(variance);
};

export interface StandardData {
  concentration: number;
  readout: number;
}

export const calculateAdvancedLoD = (
  blanks: number[],
  standards: StandardData[],
  method: 'linear' | '4pl' | '5pl' | 'auto' = '4pl',
  alpha = 0.05,
  beta = 0.05
) => {
  // 1. Limit of Blank (Lc)
  const meanBlank = calculateMean(blanks);
  const sdBlank = calculateSD(blanks);
  const dfBlank = blanks.length - 1;
  const tAlpha = tinv(1 - alpha, dfBlank);
  const lc = meanBlank + tAlpha * sdBlank;

  // 2. Limit of Detection in Signal (Ld)
  const sdTest = calculateSD(standards.map(s => s.readout));
  const dfTest = standards.length - 1;
  const tBeta = tinv(1 - beta, dfTest);
  const ld = lc + tBeta * sdTest;

  // 3. Curve Fitting
  const x = standards.map(s => s.concentration);
  const y = standards.map(s => s.readout);
  const fit = method === 'auto' ? autoFit(x, y) : fitData(x, y, method);

  // 4. LoD in Concentration space (Inverse calculation)
  let lodConc = 0;
  const p = fit.parameters;
  if (fit.method === 'linear') {
    lodConc = p['Slope (m)'] !== 0 ? (ld - p['Intercept (b)']) / p['Slope (m)'] : 0;
  } else if (fit.method === '4pl') {
    const ratio = (p['Bottom (a)'] - ld) / (ld - p['Top (d)']);
    if (ratio > 0) lodConc = p['EC50 (c)'] * Math.pow(ratio, 1 / p['Slope (b)']);
  } else if (fit.method === '5pl') {
    // Inverse 5PL: x = c * ((( (a-d)/(y-d) )^(1/g) ) - 1 )^(1/b)
    const ratio = (p['Bottom (a)'] - p['Top (d)']) / (ld - p['Top (d)']);
    if (ratio > 0) {
      const inner = Math.pow(ratio, 1 / p['Asymmetry (g)']) - 1;
      if (inner > 0) lodConc = p['EC50 (c)'] * Math.pow(inner, 1 / p['Slope (b)']);
    }
  }

  return {
    lc,
    ld,
    lodConc,
    meanBlank,
    sdBlank,
    fit,
  };
};
