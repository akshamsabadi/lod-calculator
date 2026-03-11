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

interface StandardRow {
  id: string;
  conc: string;
  signals: string;
}

const DEFAULT_BLANKS = '0.05, 0.06, 0.04, 0.05, 0.05';
const DEFAULT_STANDARDS: StandardRow[] = [
  { id: '1', conc: '0.001', signals: '0.12, 0.15, 0.10, 0.13, 0.11' },
  { id: '2', conc: '0.003', signals: '0.14, 0.17, 0.13, 0.15, 0.16' },
  { id: '3', conc: '0.01', signals: '0.18, 0.22, 0.19, 0.20, 0.21' },
  { id: '4', conc: '0.03', signals: '0.30, 0.35, 0.28, 0.32, 0.31' },
  { id: '5', conc: '0.1', signals: '0.58, 0.65, 0.55, 0.61, 0.59' },
  { id: '6', conc: '0.3', signals: '1.35, 1.48, 1.30, 1.40, 1.38' },
  { id: '7', conc: '1', signals: '3.10, 3.28, 3.05, 3.18, 3.12' },
  { id: '8', conc: '3', signals: '4.20, 4.35, 4.15, 4.28, 4.22' },
  { id: '9', conc: '10', signals: '4.62, 4.78, 4.55, 4.70, 4.65' },
  { id: '10', conc: '30', signals: '4.80, 4.92, 4.76, 4.85, 4.82' },
  { id: '11', conc: '100', signals: '4.88, 4.98, 4.84, 4.90, 4.86' },
  { id: '12', conc: '300', signals: '4.92, 5.02, 4.88, 4.95, 4.94' },
];

function App() {
  const [blankSignals, setBlankSignals] = useState(DEFAULT_BLANKS);
  const [standardRows, setStandardRows] = useState<StandardRow[]>(DEFAULT_STANDARDS);
  const [fitMethod, setFitMethod] = useState<'linear' | '4pl' | '5pl' | 'auto'>('auto');
  
  const results = useMemo(() => {
    try {
      const blanks = blankSignals
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '')
        .map(Number)
        .filter(n => !isNaN(n));

      const standards: StandardData[] = [];
      standardRows.forEach(row => {
        const c = parseFloat(row.conc);
        if (isNaN(c)) return;
        row.signals.split(',').forEach(s => {
          const val = parseFloat(s.trim());
          if (!isNaN(val)) {
            standards.push({ concentration: c, readout: val });
          }
        });
      });

      if (blanks.length < 2 || standards.length < 3) return null;
      return calculateAdvancedLoD(blanks, standards, fitMethod);
    } catch (e) {
      console.error('Calculation error:', e);
      return null;
    }
  }, [blankSignals, standardRows, fitMethod]);

  const chartData = useMemo(() => {
    if (!results) return { trend: [], actual: [] };
    
    const xValues = results.fit.actualX;
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const trendPoints: ChartPoint[] = [];
    
    const steps = 100;
    const logMin = Math.log10(minX || 0.0001);
    const logMax = Math.log10(maxX * 1.2);
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

  const addRow = () => setStandardRows([...standardRows, { id: Math.random().toString(36), conc: '', signals: '' }]);
  const removeRow = (id: string) => setStandardRows(standardRows.filter(r => r.id !== id));
  const updateRow = (id: string, field: 'conc' | 'signals', value: string) => {
    setStandardRows(standardRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  return (
    <div className="app-wrapper">
      <header>
        <div className="header-content">
          <h1>Bioassay Curve Fitter & LoD Validator</h1>
          <p className="header-description">Advanced non-linear regression suite for diagnostic assay validation.</p>
        </div>
      </header>

      <main className="main-container">
        <aside className="sidebar">
          <section className="sidebar-section">
            <span className="section-title">Model Config</span>
            <div className="input-group">
              <label className="input-label">Regression Method</label>
              <select 
                value={fitMethod} 
                onChange={(e) => setFitMethod(e.target.value as any)}
                className="method-select"
              >
                <option value="auto">Auto (4PL/5PL Optimization)</option>
                <option value="4pl">4-Parameter Logistic</option>
                <option value="5pl">5-Parameter Logistic</option>
                <option value="linear">Linear Regression</option>
              </select>
            </div>
          </section>

          <section className="sidebar-section">
            <span className="section-title">1. Background (Blanks)</span>
            <div className="data-table-header">
              <div className="col-label">Conc.</div>
              <div className="col-label">Signal Replicates</div>
            </div>
            <div className="data-row locked">
              <div className="conc-input disabled">0</div>
              <textarea
                className="signals-input"
                value={blankSignals}
                onChange={(e) => setBlankSignals(e.target.value)}
                placeholder="e.g. 0.05, 0.06..."
              />
            </div>
          </section>

          <section className="sidebar-section">
            <span className="section-title">2. Calibration Standards</span>
            <div className="data-table-header">
              <div className="col-label">Conc.</div>
              <div className="col-label">Signal Replicates</div>
            </div>
            <div className="rows-container">
              {standardRows.map((row) => (
                <div key={row.id} className="data-row">
                  <input
                    type="text"
                    className="conc-input"
                    value={row.conc}
                    onChange={(e) => updateRow(row.id, 'conc', e.target.value)}
                  />
                  <textarea
                    className="signals-input"
                    value={row.signals}
                    onChange={(e) => updateRow(row.id, 'signals', e.target.value)}
                  />
                  <button className="remove-row-btn" onClick={() => removeRow(row.id)}>×</button>
                </div>
              ))}
            </div>
            <button className="add-row-btn" onClick={addRow}>+ Add Concentration</button>
          </section>
        </aside>

        <section className="content-area">
          {results ? (
            <div className="dashboard-grid">
              <div className="chart-card">
                <div className="chart-header">
                  <h2>Dose-Response Profile</h2>
                  <div className="chart-badges">
                    <span className="method-badge">{results.fit.method.toUpperCase()} Optimized</span>
                    {results.fit.metrics.r2 > 0.99 && <span className="quality-badge">Excellent Fit</span>}
                  </div>
                </div>
                <div className="chart-frame">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart margin={{ top: 10, right: 30, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#313244" vertical={false} />
                      <XAxis 
                        dataKey="x" 
                        type="number" 
                        scale="log" 
                        domain={['auto', 'auto']}
                        stroke="#cdd6f4" 
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Analyte Concentration (log)', position: 'bottom', fill: '#9399b2', fontSize: 12, offset: 25 }}
                      />
                      <YAxis 
                        stroke="#cdd6f4" 
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Signal Intensity', angle: -90, position: 'insideLeft', fill: '#9399b2', fontSize: 12 }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#181825', borderColor: '#313244', borderRadius: '8px' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Line
                        data={chartData.trend}
                        type="monotone"
                        dataKey="trend"
                        stroke="#89b4fa"
                        strokeWidth={3}
                        dot={false}
                        name="Model Fit"
                        isAnimationActive={false}
                      />
                      <Scatter 
                        data={chartData.actual} 
                        fill="#f38ba8" 
                        name="Replicates"
                      />
                      <Line
                        data={[{ x: 1e-6, y: results.ld }, { x: 1e6, y: results.ld }]}
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
                  <div className="lod-hero-value">{results.lodConc < 0.01 ? results.lodConc.toExponential(3) : results.lodConc.toFixed(4)}</div>
                  <span className="lod-hero-unit">Concentration Units</span>
                </div>

                <div className="stats-card">
                  <h3>Metrics</h3>
                  <div className="stat-row">
                    <span className="stat-label">R² Coefficient</span>
                    <span className="stat-value">{results.fit.metrics.r2.toFixed(5)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">RMSE</span>
                    <span className="stat-value">{results.fit.metrics.rmse.toFixed(5)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">AICc</span>
                    <span className="stat-value">{results.fit.metrics.aicc.toFixed(2)}</span>
                  </div>
                </div>

                <div className="stats-card">
                  <h3>Model Parameters</h3>
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
                <div className="prompt-icon">🧪</div>
                <p>Awaiting valid assay data inputs...</p>
                <small>Requires background signals and standard replicates.</small>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
