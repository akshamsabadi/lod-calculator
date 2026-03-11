import { useState, useMemo } from 'react';
import { calculateAdvancedLoD, type StandardData } from './utils/calculations';
import {
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Legend
} from 'recharts';
import './App.css';

interface ChartPoint {
  x: number;
  y?: number;
  trend?: number;
}

interface ChartData {
  trend: ChartPoint[];
  actual: ChartPoint[];
}

function App() {
  const [blanksInput, setBlanksInput] = useState('0.1, 0.12, 0.09, 0.11, 0.1');
  const [standardsInput, setStandardsInput] = useState('1:0.2, 1:0.21, 5:0.8, 5:0.78, 10:1.5, 10:1.52, 50:6.2, 50:6.15, 100:11.8, 100:11.9');
  const [fitMethod, setFitMethod] = useState<'linear' | '4pl' | '5pl' | 'auto'>('auto');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const handleCalculate = () => {
    setError('');
    try {
      const blanks = blanksInput
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '')
        .map(Number);

      const standards: StandardData[] = standardsInput
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '')
        .map(pair => {
          const parts = pair.split(':');
          if (parts.length !== 2) throw new Error('Invalid format. Use Conc:Signal');
          const [conc, readout] = parts.map(Number);
          return { concentration: conc, readout: readout };
        });

      if (blanks.some(isNaN) || standards.some(s => isNaN(s.concentration) || isNaN(s.readout))) {
        throw new Error('Data must be numbers');
      }

      const res = calculateAdvancedLoD(blanks, standards, fitMethod);
      setResults(res);
    } catch (err: any) {
      setError(err.message || 'Check your inputs');
    }
  };

  const chartData = useMemo((): ChartData => {
    if (!results) return { trend: [], actual: [] };
    
    const xValues = results.fit.actualX;
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const trendPoints: ChartPoint[] = [];
    
    const steps = 100;
    const logMin = Math.log10(minX || 0.1);
    const logMax = Math.log10(maxX);
    const stepSize = (logMax - logMin) / steps;

    for (let i = 0; i <= steps; i++) {
      const x = Math.pow(10, logMin + i * stepSize);
      trendPoints.push({ x, trend: results.fit.predict(x) });
    }

    const actualPoints: ChartPoint[] = xValues.map((vx: number, i: number) => ({
      x: vx,
      y: results.fit.actualY[i],
    }));

    return { trend: trendPoints, actual: actualPoints };
  }, [results]);

  return (
    <div className="app-wrapper">
      <header>
        <div className="header-content">
          <h1>Bioassay Curve Fitter & LoD Validator</h1>
          <p className="header-description">Professional suite for non-linear regression, clinical limit of detection fitting, and assay performance metrics.</p>
        </div>
      </header>

      <main className="main-container">
        <aside className="sidebar">
          <div className="sidebar-section">
            <span className="section-title">Model Configuration</span>
            <div className="input-group">
              <label className="input-label">Fitting Method</label>
              <select 
                value={fitMethod} 
                onChange={(e) => setFitMethod(e.target.value as any)}
                className="method-select"
              >
                <option value="auto">Automatic (4PL vs 5PL via AICc)</option>
                <option value="4pl">4-Parameter Logistic (4PL)</option>
                <option value="5pl">5-Parameter Logistic (5PL)</option>
                <option value="linear">Linear Regression</option>
              </select>
            </div>
          </div>

          <div className="sidebar-section">
            <span className="section-title">Data Entry</span>
            <div className="input-group">
              <label className="input-label">Negative Controls (Signal)</label>
              <textarea
                value={blanksInput}
                onChange={(e) => setBlanksInput(e.target.value)}
                placeholder="0.1, 0.12, 0.09..."
              />
            </div>
            <div className="input-group" style={{ marginTop: '16px' }}>
              <label className="input-label">Standard Curve (Conc : Signal)</label>
              <p className="input-hint">Replicates allowed (e.g. 10:1.2, 10:1.3)</p>
              <textarea
                value={standardsInput}
                onChange={(e) => setStandardsInput(e.target.value)}
                placeholder="10:1.2, 50:4.5..."
                style={{ minHeight: '180px' }}
              />
            </div>
          </div>

          <button className="calc-btn" onClick={handleCalculate}>
            Run Validation Fit
          </button>
          
          {error && <div className="error-toast">{error}</div>}
        </aside>

        <section className="content-area">
          {results ? (
            <div className="dashboard-grid">
              <div className="chart-card">
                <div className="chart-header">
                  <h2>Regression Analysis & Thresholds</h2>
                  <span className="method-badge">{results.fit.method.toUpperCase()} Fit</span>
                </div>
                <div className="chart-frame">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#313244" vertical={false} />
                      <XAxis 
                        dataKey="x" 
                        type="number" 
                        scale="log" 
                        domain={['auto', 'auto']}
                        stroke="#cdd6f4" 
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Concentration (log scale)', position: 'bottom', fill: '#9399b2', fontSize: 12, offset: 0 }}
                      />
                      <YAxis 
                        stroke="#cdd6f4" 
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Signal Intensity', angle: -90, position: 'insideLeft', fill: '#9399b2', fontSize: 12 }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#181825', borderColor: '#313244', borderRadius: '8px' }}
                        itemStyle={{ fontSize: '11px' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                      <Line
                        data={chartData.trend}
                        type="monotone"
                        dataKey="trend"
                        stroke="#89b4fa"
                        strokeWidth={3}
                        dot={false}
                        name="Model Fit"
                        animationDuration={800}
                      />
                      <Scatter 
                        data={chartData.actual} 
                        fill="#f38ba8" 
                        name="Standard Replicates"
                      />
                      <Line
                        data={[{ x: 0.0001, y: results.ld }, { x: 1000000, y: results.ld }]}
                        dataKey="y"
                        stroke="#a6e3a1"
                        strokeDasharray="6 4"
                        name="Ld Threshold"
                        dot={false}
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="results-side-panel">
                <div className="lod-hero-card">
                  <label>Validated Limit of Detection</label>
                  <div className="lod-hero-value">{results.lodConc.toFixed(4)}</div>
                  <span className="lod-hero-unit">Concentration Units</span>
                </div>

                <div className="stats-card">
                  <h3>Model Performance</h3>
                  <div className="stat-row">
                    <span className="stat-label">R-Squared (CoD)</span>
                    <span className="stat-value">{results.fit.metrics.r2.toFixed(4)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Root Mean Sq. Error</span>
                    <span className="stat-value">{results.fit.metrics.rmse.toFixed(4)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">AICc (Corrected)</span>
                    <span className="stat-value">{results.fit.metrics.aicc.toFixed(2)}</span>
                  </div>
                </div>

                <div className="stats-card">
                  <h3>Optimized Parameters</h3>
                  {Object.entries(results.fit.parameters).map(([name, val]: any) => (
                    <div className="stat-row" key={name}>
                      <span className="stat-label">{name}</span>
                      <span className="stat-value">{val.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-prompt">
              <div className="prompt-content">
                <div className="prompt-icon">📈</div>
                <p>Provide assay replicates and run fitting to generate the validation dashboard.</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
