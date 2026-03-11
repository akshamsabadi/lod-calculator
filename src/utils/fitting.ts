import { levenbergMarquardt } from 'ml-levenberg-marquardt';
import { Matrix, inverse } from 'ml-matrix';

export interface FitResult {
  method: string;
  parameters: Record<string, number>;
  metrics: {
    rmse: number;
    r2: number;
    aicc: number;
  };
  predict: (x: number) => number;
  getCI: (x: number) => { low: number; high: number };
  actualX: number[];
  actualY: number[];
  k: number;
  cov: number[][];
  mse: number;
}

const models = {
  linear: {
    func: (x: number, [m, b]: number[]) => m * x + b,
    grad: (x: number, [_m, _b]: number[]) => [x, 1],
    k: 2,
    paramNames: ['Slope (m)', 'Intercept (b)'],
    initialValues: (_x: number[], y: number[]) => [1, y[0]]
  },
  '4pl': {
    func: (x: number, [a, b, c, d]: number[]) => {
      if (x <= 0) return a;
      return d + (a - d) / (1 + Math.pow(x / c, b));
    },
    grad: (x: number, [a, b, c, d]: number[]) => {
      if (x <= 0) return [1, 0, 0, 0];
      const x_c_b = Math.pow(x / c, b);
      const denom = 1 + x_c_b;
      const d_a = 1 / denom;
      const d_b = -(a - d) * (x_c_b * Math.log(x / c)) / (denom * denom);
      const d_c = (a - d) * (b * x_c_b / c) / (denom * denom);
      const d_d = x_c_b / denom;
      return [d_a, d_b, d_c, d_d];
    },
    k: 4,
    paramNames: ['Bottom (a)', 'Hill Slope (b)', 'EC50 (c)', 'Top (d)'],
    initialValues: (x: number[], y: number[]) => [Math.min(...y), 1, x[Math.floor(x.length / 2)], Math.max(...y)]
  },
  '5pl': {
    func: (x: number, [a, b, c, d, g]: number[]) => {
      if (x <= 0) return a;
      return d + (a - d) / Math.pow(1 + Math.pow(x / c, b), g);
    },
    grad: (x: number, [a, b, c, d, g]: number[]) => {
      if (x <= 0) return [1, 0, 0, 0, 0];
      const x_c_b = Math.pow(x / c, b);
      const denom_base = 1 + x_c_b;
      const denom = Math.pow(denom_base, g);
      const d_a = 1 / denom;
      const d_b = -(a - d) * g * (x_c_b * Math.log(x / c)) * Math.pow(denom_base, -g - 1);
      const d_c = (a - d) * g * (b * x_c_b / c) * Math.pow(denom_base, -g - 1);
      const d_d = 1 - (1 / denom);
      const d_g = -(a - d) * Math.log(denom_base) / denom;
      return [d_a, d_b, d_c, d_d, d_g];
    },
    k: 5,
    paramNames: ['Bottom (a)', 'Hill Slope (b)', 'EC50 (c)', 'Top (d)', 'Asymmetry (g)'],
    initialValues: (x: number[], y: number[]) => [Math.min(...y), 1, x[Math.floor(x.length / 2)], Math.max(...y), 1]
  }
};

export const fitData = (x: number[], y: number[], method: 'linear' | '4pl' | '5pl'): FitResult => {
  const n = x.length;
  const model = models[method];
  const options = { initialValues: model.initialValues(x, y), maxIterations: 1000 };
  
  let params: number[];
  let rss: number;

  if (method === 'linear') {
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    const m = x.reduce((a, b, i) => a + (b - meanX) * (y[i] - meanY), 0) / x.reduce((a, b) => a + Math.pow(b - meanX, 2), 0);
    const b = meanY - m * meanX;
    params = [m, b];
    rss = x.reduce((sum, xi, i) => sum + Math.pow(y[i] - (m * xi + b), 2), 0);
  } else {
    const result = levenbergMarquardt({ x, y }, (p: number[]) => (xi: number) => model.func(xi, p), options);
    params = result.parameterValues;
    rss = result.parameterError;
  }

  const mse = rss / (n - model.k);
  const jacobian = new Matrix(n, model.k);
  for (let i = 0; i < n; i++) {
    const g = model.grad(x[i], params);
    for (let j = 0; j < model.k; j++) jacobian.set(i, j, g[j]);
  }

  const jt = jacobian.transpose();
  const jtj = jt.mmul(jacobian);
  let cov: Matrix;
  try {
    cov = inverse(jtj).mul(mse);
  } catch (e) {
    cov = Matrix.eye(model.k).mul(mse);
  }

  const parameters: Record<string, number> = {};
  model.paramNames.forEach((name, i) => parameters[name] = params[i]);

  const meanY_all = y.reduce((s, v) => s + v, 0) / n;
  const ss_tot = y.reduce((a, b) => a + Math.pow(b - meanY_all, 2), 0);

  return {
    method,
    parameters,
    metrics: { rmse: Math.sqrt(rss / n), r2: 1 - rss / ss_tot, aicc: n * Math.log(rss / n) + 2 * model.k + (2 * model.k * (model.k + 1)) / (n - model.k - 1) },
    predict: (val: number) => model.func(val, params),
    getCI: (val: number) => {
      const g = new Matrix([model.grad(val, params)]);
      const variance = g.mmul(cov).mmul(g.transpose()).get(0, 0);
      const se = Math.sqrt(variance);
      const crit = 1.96; // 95% CI approx
      const pred = model.func(val, params);
      return { low: pred - crit * se, high: pred + crit * se };
    },
    actualX: x,
    actualY: y,
    k: model.k,
    cov: cov.to2DArray(),
    mse
  };
};

export const autoFit = (x: number[], y: number[]): FitResult => {
  const f4 = fitData(x, y, '4pl');
  const f5 = fitData(x, y, '5pl');
  return f5.metrics.aicc < f4.metrics.aicc - 2 ? f5 : f4;
};
