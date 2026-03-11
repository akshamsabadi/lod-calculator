import { fitData, autoFit } from './fitting';

export const tinv = (p: number, df: number): number => {
  if (df <= 0) return 0;
  if (df === 1) return Math.tan(Math.PI * (p - 0.5));
  const x = normInv(p);
  const t = x + (Math.pow(x, 3) + x) / (4 * df) + (5 * Math.pow(x, 5) + 16 * Math.pow(x, 3) + 3 * x) / (96 * Math.pow(df, 2));
  return t;
};

function normInv(p: number): number {
  const a1 = -39.6968302866538, a2 = 220.946098424521, a3 = -275.928510446969;
  const a4 = 138.357751867269, a5 = -30.6647980661472, a6 = 2.50662827745924;
  const b1 = -54.4760987982241, b2 = 161.585836858041, b3 = -155.698979859887;
  const b4 = 66.8013118877197, b5 = -13.2806815528857, c1 = -7.78489400243029E-03;
  const c2 = -0.322396458041136, c3 = -2.40075827716184, c4 = -2.54973253934373;
  const c5 = 4.37466414146497, c6 = 2.93816398269878, d1 = 7.78469570904146E-03;
  const d2 = 0.32246712907004, d3 = 2.445134137143, d4 = 3.75440866190742;
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
}

export interface StandardData {
  concentration: number;
  readout: number;
}

const calculatePooledSD = (standards: StandardData[]) => {
  const groups: Record<number, number[]> = {};
  standards.forEach(s => {
    if (!groups[s.concentration]) groups[s.concentration] = [];
    groups[s.concentration].push(s.readout);
  });
  let ss = 0, n = 0, k = 0;
  Object.values(groups).forEach(reps => {
    if (reps.length < 1) return;
    const m = reps.reduce((a, b) => a + b, 0) / reps.length;
    reps.forEach(r => ss += Math.pow(r - m, 2));
    n += reps.length; k++;
  });
  const df = n - k;
  return { sd: df > 0 ? Math.sqrt(ss / df) : 0, df };
};

export const calculateAdvancedLoD = (
  blanks: number[],
  standards: StandardData[],
  method: 'linear' | '4pl' | '5pl' | 'auto' = '4pl',
  alpha = 0.05,
  beta = 0.05
) => {
  const meanBlank = blanks.reduce((a,b)=>a+b,0)/blanks.length;
  const sdBlank = Math.sqrt(blanks.reduce((a,b)=>a+Math.pow(b-meanBlank,2),0)/(blanks.length-1));
  const lc = meanBlank + tinv(1 - alpha, blanks.length - 1) * sdBlank;
  const { sd: sdPooled, df: dfPooled } = calculatePooledSD(standards);
  const ld = lc + tinv(1 - beta, dfPooled) * sdPooled;

  const x = standards.map(s => s.concentration);
  const y = standards.map(s => s.readout);
  const fit = method === 'auto' ? autoFit(x, y) : fitData(x, y, method);

  let lodConc = 0;
  const p = fit.parameters;
  if (fit.method === 'linear') {
    lodConc = (ld - p['Intercept (b)']) / p['Slope (m)'];
  } else if (fit.method === '4pl') {
    const ratio = (p['Bottom (a)'] - ld) / (ld - p['Top (d)']);
    if (ratio > 0) lodConc = p['EC50 (c)'] * Math.pow(ratio, 1 / p['Hill Slope (b)']);
  } else if (fit.method === '5pl') {
    const ratio = (p['Bottom (a)'] - p['Top (d)']) / (ld - p['Top (d)']);
    if (ratio > 0) {
      const inner = Math.pow(ratio, 1 / p['Asymmetry (g)']) - 1;
      if (inner > 0) lodConc = p['EC50 (c)'] * Math.pow(inner, 1 / p['Hill Slope (b)']);
    }
  }

  // Miller-style LOD CI (Placeholder for full delta method)
  const lodCI = { low: lodConc * 0.85, high: lodConc * 1.15 };

  return { lc, ld, lodConc, lodCI, meanBlank, sdBlank, sdPooled, fit };
};
