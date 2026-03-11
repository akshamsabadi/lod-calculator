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

function App() {
  const [blankSignals, setBlankSignals] = useState('0.1, 0.12, 0.09, 0.11, 0.1');
  const [standardRows, setStandardRows] = useState<StandardRow[]>([
    { id: '1', conc: '1', signals: '0.2, 0.22' },
    { id: '2', conc: '5', signals: '0.8, 0.85' },
    { id: '3', conc: '10', signals: '1.5, 1.6' },
    { id: '4', conc: '50', signals: '6.2, 6.4' },
    { id: '5', conc: '100', signals: '11.8, 12.1' },
    { id: '6', conc: '500', signals: '15.2, 15.5' },
    { id: '7', conc: '1000', signals: '16.1, 16.3' },
  ]);
  const [fitMethod, setFitMethod] = useState<'linear' | '4pl' | '5pl' | 'auto'>('auto');
  
  // Results calculated automatically
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
      return null;
    }
  }, [blankSignals, standardRows, fitMethod]);

  const addRow = () => {
    setStandardRows([...standardRows, { id: Math.random().toString(36), conc: '', signals: '' }]);
  };

  const removeRow = (id: string) => {
    setStandardRows(standardRows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: 'conc' | 'signals', value: string) => {
    setStandardRows(standardRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const chartData = useMemo(() => {
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
          <p className="header-description">Precision regression and clinical validation suite. Updates automatically as you enter data.</p>
        </div>
      </header>

      <main className="main-container">
        <aside className="sidebar">
          <section className="sidebar-section">
            <span className="section-title">Model Configuration</span>
            <div className="input-group">
              <label className="input-label">Fitting Method</label>
              <select 
                value={fitMethod} 
                onChange={(e) => setFitMethod(e.target.value as any)}
                className="method-select"
              >
                <option value="auto">Automatic (AICc Optimized)</option>
                <option value="4pl">4-Parameter Logistic (4PL)</option>
                <option value="5pl">5-Parameter Logistic (5PL)</option>
                <option value="linear">Linear Regression</option>
              </select>
            </div>
          </section>

          <section className="sidebar-section">
            <span className="section-title">1. Negative Controls (Blanks)</span>
            <div className="data-table-header">
              <div className="col-label">Conc.</div>
              <div className="col-label">Signals (comma-separated)</div>
            </div>
            <div className="data-row locked">
              <div className="conc-input disabled">0</div>
              <textarea
                className="signals-input"
                value={blankSignals}
                onChange={(e) => setBlankSignals(e.target.value)}
                placeholder="0.1, 0.12..."
              />
            </div>
          </section>

          <section className="sidebar-section">
            <span className="section-title">2. Standard Curve Data</span>
            <div className="data-table-header">
              <div className="col-label">Conc.</div>
              <div className="col-label">Signals (comma-separated)</div>
            </div>
            <div className="rows-container">
              {standardRows.map((row) => (
                <div key={row.id} className="data-row">
                  <input
                    type="number"
                    className="conc-input"
                    value={row.conc}
                    onChange={(e) => updateRow(row.id, 'conc', e.target.value)}
                    placeholder="Conc"
                  />
                  <textarea
                    className="signals-input"
                    value={row.signals}
                    onChange={(e) => updateRow(row.id, 'signals', e.target.value)}
                    placeholder="Signal replicates..."
                  />
                  <button className="remove-row-btn" onClick={() => removeRow(row.id)}>×</button>
                </div>
              ))}
            </div>
            <button className="add-row-btn" onClick={addRow}>+ Add Concentration Point</button>
          </section>
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
                        isAnimationActive={false}
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
                <small>Need at least 2 blanks and 3 standard points.</small>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
