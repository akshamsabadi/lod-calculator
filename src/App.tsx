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
  ReferenceLine,
  Area
} from 'recharts';
import './App.css';

interface StandardRow {
  id: string;
  conc: string;
  signals: string;
}

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
  const [blankSignals, setBlankSignals] = useState('0.05, 0.06, 0.04, 0.05, 0.05');
  const [standardRows, setStandardRows] = useState<StandardRow[]>(DEFAULT_STANDARDS);
  const [fitMethod] = useState<'linear' | '4pl' | '5pl' | 'auto'>('auto');
  const [plotTitle, setPlotTitle] = useState('Miller-Style Assay Analysis');
  const [xAxisLabel, setXAxisLabel] = useState('Concentration (M)');
  const [yAxisLabel, setYAxisLabel] = useState('Signal Intensity');

  const results = useMemo(() => {
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

  const chartData = useMemo(() => {
    if (!results) return [];
    const minX = Math.min(...results.fit.actualX.filter(x => x > 0));
    const maxX = Math.max(...results.fit.actualX);
    const zeroX = minX / 10;
    const data = [];
    const logMin = Math.log10(zeroX);
    const logMax = Math.log10(maxX * 1.5);
    for (let i = 0; i <= 100; i++) {
      const x = Math.pow(10, logMin + i * (logMax - logMin) / 100);
      const fitX = x < minX * 0.5 ? 0 : x;
      const pred = results.fit.predict(fitX);
      const { low, high } = results.fit.getCI(fitX);
      data.push({ x, trend: pred, ciLow: low, ciHigh: high });
    }
    return data;
  }, [results]);

  const scatterData = useMemo(() => {
    if (!results) return [];
    const minX = Math.min(...results.fit.actualX.filter(x => x > 0));
    const zeroX = minX / 10;
    return results.fit.actualX.map((x, i) => ({ x: x === 0 ? zeroX : x, y: results.fit.actualY[i] }));
  }, [results]);

  const updateRow = (id: string, field: 'conc' | 'signals', value: string) => {
    setStandardRows(standardRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  return (
    <div className="app-wrapper">
      <header>
        <div className="header-content">
          <h1>Bioassay Analytics Pro v9.0</h1>
          <p className="header-description">Miller-style clinical LoD fitting with 95% Confidence Intervals.</p>
        </div>
      </header>
      <main className="main-container">
        <aside className="sidebar">
          <section className="sidebar-section">
            <span className="section-title">Plot Settings</span>
            <div className="input-group"><label className="input-label">Title</label><input type="text" className="text-input" value={plotTitle} onChange={e => setPlotTitle(e.target.value)} /></div>
            <div className="input-group"><label className="input-label">X Axis</label><input type="text" className="text-input" value={xAxisLabel} onChange={e => setXAxisLabel(e.target.value)} /></div>
            <div className="input-group"><label className="input-label">Y Axis</label><input type="text" className="text-input" value={yAxisLabel} onChange={e => setYAxisLabel(e.target.value)} /></div>
          </section>
          <section className="sidebar-section">
            <span className="section-title">1. Blanks</span>
            <div className="data-row"><div className="conc-input disabled">0</div><textarea className="signals-input" value={blankSignals} onChange={e => setBlankSignals(e.target.value)} /></div>
          </section>
          <section className="sidebar-section">
            <span className="section-title">2. Standards</span>
            <div className="rows-container">
              {standardRows.map((r) => (
                <div key={r.id} className="data-row">
                  <input type="text" className="conc-input" value={r.conc} onChange={e => updateRow(r.id, 'conc', e.target.value)} />
                  <textarea className="signals-input" value={r.signals} onChange={e => updateRow(r.id, 'signals', e.target.value)} />
                  <button className="remove-row-btn" onClick={() => setStandardRows(standardRows.filter(sr => sr.id !== r.id))}>×</button>
                </div>
              ))}
            </div>
            <button className="add-row-btn" onClick={() => setStandardRows([...standardRows, { id: Math.random().toString(36), conc: '', signals: '' }])}>+ Add Point</button>
          </section>
        </aside>
        <section className="content-area">
          {results ? (
            <div className="dashboard-grid">
              <div className="chart-card">
                <div className="chart-header"><h2>{plotTitle}</h2><span className="method-badge">{results.fit.method.toUpperCase()}</span></div>
                <div className="chart-frame">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 40, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#313244" vertical={false} />
                      <XAxis 
                        dataKey="x" type="number" scale="log" domain={['auto', 'auto']} stroke="#cdd6f4" 
                        tickFormatter={(val) => {
                          const minX = Math.min(...results.fit.actualX.filter(x => x > 0));
                          return val < minX * 0.2 ? '0' : val.toExponential(1);
                        }}
                        label={{ value: xAxisLabel, position: 'bottom', fill: '#9399b2', fontSize: 12, offset: 25 }}
                      />
                      <YAxis stroke="#cdd6f4" label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#9399b2', fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#181825', borderColor: '#313244' }} />
                      <Area dataKey="ciHigh" data={chartData} stroke="none" fill="#89b4fa" fillOpacity={0.15} isAnimationActive={false} />
                      <Area dataKey="ciLow" data={chartData} stroke="none" fill="transparent" isAnimationActive={false} />
                      <Line dataKey="trend" stroke="#89b4fa" strokeWidth={3} dot={false} isAnimationActive={false} />
                      <Scatter data={scatterData} fill="#f38ba8" />
                      <ReferenceLine y={results.lc} stroke="#fab387" strokeDasharray="4 4" label={{ position: 'right', value: 'Lc', fill: '#fab387', fontSize: 10 }} />
                      <ReferenceLine y={results.ld} stroke="#a6e3a1" strokeDasharray="4 4" label={{ position: 'right', value: 'Ld', fill: '#a6e3a1', fontSize: 10 }} />
                      <ReferenceLine x={results.lodConc} stroke="#f9e2af" strokeWidth={2} label={{ position: 'top', value: 'LOD', fill: '#f9e2af', fontSize: 11 }} />
                      <ReferenceLine x={results.lodCI.low} stroke="#f9e2af" strokeDasharray="2 2" strokeOpacity={0.5} />
                      <ReferenceLine x={results.lodCI.high} stroke="#f9e2af" strokeDasharray="2 2" strokeOpacity={0.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="results-side-panel">
                <div className="lod-hero-card"><label>Validated LOD</label><div className="lod-hero-value">{results.lodConc.toExponential(3)}</div><span className="lod-hero-unit">{xAxisLabel.split(' ')[0]}</span></div>
                <div className="stats-card">
                  <h3>Thresholds</h3>
                  <div className="stat-row"><span className="stat-label">Lc (Blank)</span><span className="stat-value">{results.lc.toFixed(4)}</span></div>
                  <div className="stat-row"><span className="stat-label">Ld (Signal)</span><span className="stat-value">{results.ld.toFixed(4)}</span></div>
                  <div className="stat-row"><span className="stat-label">R-Squared</span><span className="stat-value">{results.fit.metrics.r2.toFixed(5)}</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-prompt"><p>Loading analytics dashboard...</p></div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
