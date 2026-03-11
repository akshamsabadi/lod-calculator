import { levenbergMarquardt } from 'ml-levenberg-marquardt';

export interface FitResult {
  method: string;
  parameters: Record<string, number>;
  metrics: {
    rmse: number;
    r2: number;
    aicc: number;
  };
  predict: (x: number) => number;
  actualX: number[];
  actualY: number[];
  k: number;
}

export const calculateAICc = (rss: number, n: number, k: number): number => {
  if (n <= k + 1) return Infinity;
  const aic = n * Math.log(rss / n) + 2 * k;
  return aic + (2 * k * (k + 1)) / (n - k - 1);
};

export const calculateR2 = (actual: number[], predicted: number[]): number => {
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  const ssRes = actual.reduce((a, b, i) => a + Math.pow(b - predicted[i], 2), 0);
  const ssTot = actual.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
};

const models = {
  linear: {
    func: (x: number, [m, b]: number[]) => m * x + b,
    k: 2,
    paramNames: ['Slope (m)', 'Intercept (b)'],
    initialValues: (_x: number[], y: number[]) => [1, y[0]]
  },
  '4pl': {
    func: (x: number, [a, b, c, d]: number[]) => {
      if (x <= 0) return a;
      return d + (a - d) / (1 + Math.pow(x / c, b));
    },
    k: 4,
    paramNames: ['Bottom (a)', 'Slope (b)', 'EC50 (c)', 'Top (d)'],
    initialValues: (x: number[], y: number[]) => [Math.min(...y), 1, (Math.min(...x) + Math.max(...x)) / 2, Math.max(...y)]
  },
  '5pl': {
    func: (x: number, [a, b, c, d, g]: number[]) => {
      if (x <= 0) return a;
      return d + (a - d) / Math.pow(1 + Math.pow(x / c, b), g);
    },
    k: 5,
    paramNames: ['Bottom (a)', 'Slope (b)', 'EC50 (c)', 'Top (d)', 'Asymmetry (g)'],
    initialValues: (x: number[], y: number[]) => [Math.min(...y), 1, (Math.min(...x) + Math.max(...x)) / 2, Math.max(...y), 1]
  }
};

export const fitData = (
  x: number[],
  y: number[],
  method: 'linear' | '4pl' | '5pl'
): FitResult => {
  const n = x.length;
  const model = models[method];

  let params: number[];
  let rss: number;

  if (method === 'linear') {
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    const m = x.reduce((a, b, i) => a + (b - meanX) * (y[i] - meanY), 0) / 
              x.reduce((a, b) => a + Math.pow(b - meanX, 2), 0);
    const b = meanY - m * meanX;
    params = [m, b];
    rss = x.reduce((sum, xi, i) => sum + Math.pow(y[i] - (m * xi + b), 2), 0);
  } else {
    const options = {
      initialValues: model.initialValues(x, y),
      maxIterations: 1000,
    };

    const result = levenbergMarquardt({ x, y }, (p: number[]) => (x: number) => model.func(x, p), options);
    params = result.parameterValues;
    rss = result.parameterError;
  }

  const predicted = x.map(val => model.func(val, params));
  const rmse = Math.sqrt(rss / n);
  const r2 = calculateR2(y, predicted);
  const aicc = calculateAICc(rss, n, model.k);

  const parameters: Record<string, number> = {};
  model.paramNames.forEach((name, i) => {
    parameters[name] = params[i];
  });

  return {
    method,
    parameters,
    metrics: { rmse, r2, aicc },
    predict: (val: number) => model.func(val, params),
    actualX: x,
    actualY: y,
    k: model.k
  };
};

export const autoFit = (x: number[], y: number[]): FitResult => {
  const fit4 = fitData(x, y, '4pl');
  const fit5 = fitData(x, y, '5pl');

  if (fit5.metrics.aicc < fit4.metrics.aicc - 2) {
    return fit5;
  }
  return fit4;
};
