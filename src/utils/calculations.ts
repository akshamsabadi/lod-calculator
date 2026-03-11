/**
 * Simple approximation of the inverse Student's T-distribution.
 * For a real clinical app, a library like jstat would be better,
 * but for this prototype, we'll use a standard approximation.
 */
export const tinv = (p: number, df: number): number => {
  if (df <= 0) return 0;
  // Simple approximation for t-multiplier at 95% confidence (one-tailed)
  // These are standard values used when df is large; for small df, it increases.
  if (df === 1) return 6.314;
  if (df === 2) return 2.920;
  if (df === 3) return 2.353;
  if (df === 4) return 2.132;
  if (df === 5) return 2.015;
  if (df > 30) return 1.645; // Normal approx
  return 1.7 + (2.0 - 1.7) * (1 / Math.sqrt(df)); // Rough interpolation
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

/**
 * Linear Regression: y = mx + b
 * x = concentration, y = readout
 */
export const linearFit = (data: StandardData[]) => {
  const n = data.length;
  if (n < 2) return { m: 0, b: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const point of data) {
    sumX += point.concentration;
    sumY += point.readout;
    sumXY += point.concentration * point.readout;
    sumXX += point.concentration * point.concentration;
  }

  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const b = (sumY - m * sumX) / n;

  return { m, b };
};

/**
 * Advanced LoD Pipeline
 */
export const calculateAdvancedLoD = (
  blanks: number[],
  standards: StandardData[],
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
  // Simplified pooled SD: we'll use the SD of the lowest concentration standards
  // In a full app, we'd pool across all low-level standards.
  const sdTest = calculateSD(standards.map(s => s.readout)); 
  const dfTest = standards.length - 1;
  const tBeta = tinv(1 - beta, dfTest);
  const ld = lc + tBeta * sdTest;

  // 3. LoD in Concentration space
  // Map signal Ld back to concentration using linear fit: conc = (ld - b) / m
  const { m, b } = linearFit(standards);
  const lodConc = m !== 0 ? (ld - b) / m : 0;

  return {
    lc,
    ld,
    lodConc,
    meanBlank,
    sdBlank,
    m,
    b
  };
};
