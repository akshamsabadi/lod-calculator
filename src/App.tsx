import { useState, useMemo, type ReactNode } from 'react';
import { calculateAdvancedLoD, type StandardData, type AdvancedLoDResult } from './utils/calculations';
import {
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ReferenceLine,
  Area,
  Legend
} from 'recharts';
import './App.css';

interface StandardRow {
  id: string;
  conc: string;
  signals: string;
}

const DEFAULT_STANDARDS: StandardRow[] = [
  { id: '1', conc: '0.001', signals: '0.10, 0.11, 0.10' },
  { id: '2', conc: '0.003', signals: '0.11, 0.12, 0.11' },
  { id: '3', conc: '0.01', signals: '0.14, 0.15, 0.14' },
  { id: '4', conc: '0.03', signals: '0.23, 0.25, 0.24' },
  { id: '5', conc: '0.1', signals: '0.53, 0.55, 0.54' },
  { id: '6', conc: '0.3', signals: '1.22, 1.24, 1.23' },
  { id: '7', conc: '1', signals: '2.54, 2.56, 2.55' },
  { id: '8', conc: '3', signals: '3.77, 3.79, 3.78' },
  { id: '9', conc: '10', signals: '4.54, 4.56, 4.55' },
  { id: '10', conc: '30', signals: '4.83, 4.85, 4.84' },
  { id: '11', conc: '100', signals: '4.94, 4.96, 4.95' },
  { id: '12', conc: '300', signals: '4.97, 4.99, 4.98' },
];

const DEFAULT_BLANKS = '0.09, 0.10, 0.11';

const formatSuperscript = (val: number): ReactNode => {
  if (val === 0 || isNaN(val)) return '0';
  const exponent = Math.floor(Math.log10(Math.abs(val)));
  const base = (val / Math.pow(10, exponent)).toFixed(2);
  if (parseFloat(base) === 1) {
    return <span>10<sup>{exponent}</sup></span>;
  }
  return <span>{base} × 10<sup>{exponent}</sup></span>;
};

const CustomXAxisTick = ({ x, y, payload }: any) => {
  if (payload.value === 0 || isNaN(payload.value)) return <text x={x} y={y + 12} fill="#9399b2" textAnchor="middle" fontSize={10}>0</text>;
  const val = payload.value;
  const exponent = Math.round(Math.log10(Math.abs(val)));

  return (
    <text x={x} y={y + 12} fill="#9399b2" textAnchor="middle" fontSize={10}>
      <tspan>1 × 10</tspan>
      <tspan baselineShift="super" fontSize={8}>{exponent}</tspan>
    </text>
  );
};

const CustomLcLabel = ({ viewBox }: any) => {
  return (
    <text x={viewBox.x + viewBox.width + 5} y={viewBox.y + 4} fill="#fab387" fontSize={10}>
      L<tspan baselineShift="sub" fontSize={8}>C</tspan>
    </text>
  );
};

const CustomLdLabel = ({ viewBox }: any) => {
  return (
    <text x={viewBox.x + viewBox.width + 5} y={viewBox.y + 4} fill="#a6e3a1" fontSize={10}>
      L<tspan baselineShift="sub" fontSize={8}>D</tspan>
    </text>
  );
};

function App() {
  const [blankSignals, setBlankSignals] = useState(DEFAULT_BLANKS);
  const [standardRows, setStandardRows] = useState<StandardRow[]>(DEFAULT_STANDARDS);
  const [fitMethod, setFitMethod] = useState<'4pl' | '5pl' | 'auto'>('auto');
  const [plotTitle, setPlotTitle] = useState('Dose-Response Fitting');
  const [xAxisLabel, setXAxisLabel] = useState('Concentration (M)');
  const [yAxisLabel, setYAxisLabel] = useState('Signal Intensity');

  const results = useMemo((): AdvancedLoDResult | null => {
    try {
      const blanks = blankSignals.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const standards: StandardData[] = [];
      standardRows.forEach(row => {
        const c = parseFloat(row.conc);
        if (isNaN(c)) return;
        row.signals.split(',').forEach(s => {
          const val = parseFloat(s.trim());
          if (!isNaN(val)) standards.push({ concentration: c, readout: val });
        });
      });
      if (blanks.length < 2 || standards.length < 3) return null;
      return calculateAdvancedLoD(blanks, standards, fitMethod);
    } catch (e) { return null; }
  }, [blankSignals, standardRows, fitMethod]);

  const xTicks = useMemo(() => {
    if (!results) return [];
    const minX = Math.min(...results.fit.actualX.filter(x => x > 0));
    const maxX = Math.max(...results.fit.actualX);
    const zeroX = minX / 10;
    const logMin = Math.floor(Math.log10(zeroX));
    const logMax = Math.ceil(Math.log10(maxX * 1.5));
    const ticks = [];
    for (let i = logMin; i <= logMax; i++) {
      ticks.push(Math.pow(10, i));
    }
    return ticks;
  }, [results]);

  const chartData = useMemo(() => {
    if (!results) return [];
    const minX = Math.min(...results.fit.actualX.filter(x => x > 0));
    const maxX = Math.max(...results.fit.actualX);
    const zeroX = minX / 10;
    const data = [];
    const logMin = Math.log10(zeroX);
    const logMax = Math.log10(maxX * 1.5);
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const xVal = Math.pow(10, logMin + i * (logMax - logMin) / steps);
      const fitX = xVal < minX * 0.5 ? 0 : xVal;
      const pred = results.fit.predict(fitX);
      const { low, high } = results.fit.getCI(fitX);
      data.push({ x: xVal, trend: pred, ciRange: [low, high] });
    }
    return data;
  }, [results]);

  const scatterData = useMemo(() => {
    if (!results) return [];
    const minX = Math.min(...results.fit.actualX.filter(x => x > 0));
    const zeroX = minX / 10;
    
    const points: {x: number, y: number}[] = results.fit.actualX.map((x, i) => ({ 
      x: x === 0 ? zeroX : x, 
      y: results.fit.actualY[i] 
    }));
    
    const blanks = blankSignals.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    blanks.forEach(y => points.push({ x: zeroX, y }));
    
    return points;
  }, [results, blankSignals]);

  const yDomain = useMemo((): [number | 'auto', number | 'auto'] => {
    if (!results) return [0, 'auto'];
    const maxData = Math.max(...results.fit.actualY, results.ld);
    const minData = Math.min(...results.fit.actualY, 0);
    return [minData, maxData * 1.15];
  }, [results]);

  const updateRow = (id: string, field: 'conc' | 'signals', value: string) => {
    setStandardRows(standardRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleClearData = () => {
    setBlankSignals('');
    setStandardRows([{ id: '1', conc: '', signals: '' }]);
  };

  const handleLoadDemo = () => {
    setBlankSignals(DEFAULT_BLANKS);
    setStandardRows(DEFAULT_STANDARDS);
  };

  const handleCopyMetrics = () => {
    if (!results) return;
    const text = `Bioassay Results\nLOD: ${results.lodConc.toExponential(3)}\nAICc: ${results.fit.metrics.aicc.toFixed(2)}\nR2: ${results.fit.metrics.r2.toFixed(5)}\nL_Blank: ${results.lc.toFixed(4)}\nL_Detection: ${results.ld.toFixed(4)}`;
    navigator.clipboard.writeText(text);
    alert('Metrics copied to clipboard!');
  };

  return (
    <div className="app-wrapper">
      <header>
        <div className="header-content">
          <h1>Bioassay Analytics Pro v10.1</h1>
          <p className="header-description">Professional sigmoidal fitting with Clinical LoD validation.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="action-btn" onClick={handleClearData}>Clear Data</button>
          <button className="action-btn" onClick={handleLoadDemo}>Load Demo</button>
        </div>
      </header>
      <main className="main-container">
        <aside className="sidebar">
          <section className="sidebar-section">
            <span className="section-title" style={{ color: 'var(--mauve)' }}>Model Options</span>
            <select value={fitMethod} onChange={e => setFitMethod(e.target.value as any)} className="method-select">
              <option value="auto">Automatic (AICc Optimized)</option>
              <option value="4pl">4-Parameter Logistic (4PL)</option>
              <option value="5pl">5-Parameter Logistic (5PL)</option>
            </select>
          </section>
          <section className="sidebar-section">
            <span className="section-title" style={{ color: 'var(--sapphire)' }}>Plot Settings</span>
            <div className="input-group"><input type="text" className="text-input" placeholder="Title" value={plotTitle} onChange={e => setPlotTitle(e.target.value)} /></div>
            <div style={{display: 'flex', gap: '8px'}}>
              <input type="text" className="text-input" placeholder="X Axis" value={xAxisLabel} onChange={e => setXAxisLabel(e.target.value)} />
              <input type="text" className="text-input" placeholder="Y Axis" value={yAxisLabel} onChange={e => setYAxisLabel(e.target.value)} />
            </div>
          </section>
          <section className="sidebar-section">
            <span className="section-title" style={{ color: 'var(--peach)' }}>1. Blanks</span>
            <div className="data-row"><div className="conc-input disabled" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>0</div><input type="text" className="signals-input" placeholder="Comma separated..." value={blankSignals} onChange={e => setBlankSignals(e.target.value)} /></div>
          </section>
          <section className="sidebar-section">
            <span className="section-title" style={{ color: 'var(--green)' }}>2. Standards</span>
            <div className="rows-container">
              {standardRows.map((r) => (
                <div key={r.id} className="data-row">
                  <input type="text" className="conc-input" placeholder="Conc" value={r.conc} onChange={e => updateRow(r.id, 'conc', e.target.value)} />
                  <input type="text" className="signals-input" placeholder="Signals..." value={r.signals} onChange={e => updateRow(r.id, 'signals', e.target.value)} />
                  <button className="remove-row-btn" onClick={() => setStandardRows(standardRows.filter(sr => sr.id !== r.id))}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="add-row-btn" style={{ flex: 1 }} onClick={() => setStandardRows([...standardRows, { id: Math.random().toString(36), conc: '', signals: '' }])}>+ Add Point</button>
              {standardRows.length > 1 && (
                <button className="remove-last-btn" style={{ flex: 1 }} onClick={() => setStandardRows(standardRows.slice(0, -1))}>- Remove Last</button>
              )}
            </div>
          </section>
        </aside>
        <section className="content-area">
          {results ? (
            <div className="dashboard-grid">
              <div className="chart-card">
                <div className="chart-header">
                  <h2>{plotTitle}</h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="method-badge">{results.fit.method.toUpperCase()} FIT</span>
                    {results.comparison.betterMethod !== results.fit.method && results.fit.method !== 'auto' && (
                      <span className="warning-badge">Better fit available ({results.comparison.betterMethod.toUpperCase()})</span>
                    )}
                  </div>
                </div>
                <div className="chart-frame">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#313244" vertical={false} />
                      <XAxis 
                        dataKey="x" type="number" scale="log" domain={['auto', 'auto']} stroke="#cdd6f4" 
                        ticks={xTicks}
                        tick={<CustomXAxisTick />}
                        label={{ value: xAxisLabel, position: 'bottom', fill: '#9399b2', fontSize: 11, offset: 25 }}
                      />
                      <YAxis 
                        stroke="#cdd6f4" 
                        domain={yDomain} 
                        allowDataOverflow={true}
                        tickFormatter={(val) => parseFloat(val.toFixed(2)).toString()}
                        label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#9399b2', fontSize: 11, offset: -5 }} 
                      />
                      <Tooltip contentStyle={{ backgroundColor: '#181825', borderColor: '#313244', borderRadius: '8px', fontSize: '12px' }} />
                      <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                      
                      <Area dataKey="ciRange" stroke="none" fill="#89b4fa" fillOpacity={0.15} isAnimationActive={false} name="95% CI" />
                      <Line dataKey="trend" stroke="#89b4fa" strokeWidth={3} dot={false} isAnimationActive={false} name="Model Fit" />
                      <Scatter data={scatterData} fill="#f38ba8" name="Measured Data" dataKey="y" isAnimationActive={false} />
                      
                      <ReferenceLine y={results.lc} stroke="#fab387" strokeDasharray="4 4" label={<CustomLcLabel />} />
                      <ReferenceLine y={results.ld} stroke="#a6e3a1" strokeDasharray="4 4" label={<CustomLdLabel />} />
                      <ReferenceLine x={results.lodConc} stroke="#f9e2af" strokeWidth={2} label={{ position: 'top', value: 'LOD', fill: '#f9e2af', fontSize: 10 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="results-side-panel">
                <div className="lod-hero-card">
                  <label>Validated LOD</label>
                  <div className="lod-hero-value">{formatSuperscript(results.lodConc)}</div>
                  <span className="lod-hero-unit">{xAxisLabel.split('(')[0].trim()}</span>
                </div>
                <div className="stats-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0 }}>Curve Fitting</h3>
                    <button className="action-btn" onClick={handleCopyMetrics} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>Copy</button>
                  </div>
                  <div className="stat-row"><span className="stat-label">AICc Score</span><span className="stat-value">{results.fit.metrics.aicc.toFixed(2)}</span></div>
                  <div className="stat-row"><span className="stat-label">R² (Fit)</span><span className="stat-value">{results.fit.metrics.r2.toFixed(5)}</span></div>
                  <div className="stat-row"><span className="stat-label">Bottom (a)</span><span className="stat-value">{results.fit.parameters['Bottom (a)']?.toFixed(4) || 'N/A'}</span></div>
                  <div className="stat-row"><span className="stat-label">Hill Slope (b)</span><span className="stat-value">{results.fit.parameters['Hill Slope (b)']?.toFixed(4) || 'N/A'}</span></div>
                  <div className="stat-row"><span className="stat-label">EC50 (c)</span><span className="stat-value">{results.fit.parameters['EC50 (c)']?.toFixed(4) || 'N/A'}</span></div>
                  <div className="stat-row"><span className="stat-label">Top (d)</span><span className="stat-value">{results.fit.parameters['Top (d)']?.toFixed(4) || 'N/A'}</span></div>
                  {results.fit.parameters['Asymmetry (g)'] !== undefined && (
                    <div className="stat-row"><span className="stat-label">Asymmetry (g)</span><span className="stat-value">{results.fit.parameters['Asymmetry (g)'].toFixed(4)}</span></div>
                  )}
                </div>
                <div className="stats-card">
                  <h3>Clinical Validation</h3>
                  <div className="stat-row"><span className="stat-label">Blank Mean</span><span className="stat-value">{results.meanBlank.toFixed(4)}</span></div>
                  <div className="stat-row"><span className="stat-label">Blank SD</span><span className="stat-value">{results.sdBlank.toFixed(4)}</span></div>
                  <div className="stat-row"><span className="stat-label">Pooled SD</span><span className="stat-value">{results.sdPooled.toFixed(4)}</span></div>
                  <div className="stat-row"><span className="stat-label">L_Blank (L<sub>C</sub>)</span><span className="stat-value" style={{color: '#fab387'}}>{results.lc.toFixed(4)}</span></div>
                  <div className="stat-row"><span className="stat-label">L_Detection (L<sub>D</sub>)</span><span className="stat-value" style={{color: '#a6e3a1'}}>{results.ld.toFixed(4)}</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-prompt"><p>Loading Bioassay Analytics Pro v10.0...</p></div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;