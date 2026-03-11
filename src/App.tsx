import { useState, useMemo, useRef, type ReactNode } from 'react';
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
  ReferenceArea,
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
  { id: '1', conc: '0.001', signals: '0.08, 0.15, 0.09' },
  { id: '2', conc: '0.003', signals: '0.10, 0.18, 0.11' },
  { id: '3', conc: '0.01', signals: '0.14, 0.10, 0.19' },
  { id: '4', conc: '0.03', signals: '0.20, 0.32, 0.23' },
  { id: '5', conc: '0.1', signals: '0.45, 0.65, 0.52' },
  { id: '6', conc: '0.3', signals: '1.05, 1.45, 1.20' },
  { id: '7', conc: '1', signals: '2.30, 2.80, 2.45' },
  { id: '8', conc: '3', signals: '3.50, 4.00, 3.65' },
  { id: '9', conc: '10', signals: '4.30, 4.75, 4.45' },
  { id: '10', conc: '30', signals: '4.65, 5.05, 4.75' },
  { id: '11', conc: '100', signals: '4.80, 5.20, 4.85' },
  { id: '12', conc: '300', signals: '4.85, 5.25, 4.90' },
];

const DEFAULT_BLANKS = '0.07, 0.13, 0.08';

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
  if (payload.value === 0 || isNaN(payload.value)) return <text x={x} y={y + 12} fill="var(--overlay2)" textAnchor="middle" fontSize={10}>0</text>;
  const val = payload.value;
  const rawExponent = Math.log10(Math.abs(val));
  const isMajor = Math.abs(rawExponent - Math.round(rawExponent)) < 0.0001;
  
  if (!isMajor) return null;

  const exponent = Math.round(rawExponent);

  return (
    <text x={x} y={y + 12} fill="var(--overlay2)" textAnchor="middle" fontSize={10}>
      <tspan>1 × 10</tspan>
      <tspan baselineShift="super" fontSize={8}>{exponent}</tspan>
    </text>
  );
};

const CustomLcLabel = ({ viewBox }: any) => {
  return (
    <text x={viewBox.x + viewBox.width + 5} y={viewBox.y + 4} fill="var(--peach)" fontSize={10}>
      L<tspan baselineShift="sub" fontSize={8}>C</tspan>
    </text>
  );
};

const CustomLdLabel = ({ viewBox }: any) => {
  return (
    <text x={viewBox.x + viewBox.width + 5} y={viewBox.y + 4} fill="var(--green)" fontSize={10}>
      L<tspan baselineShift="sub" fontSize={8}>D</tspan>
    </text>
  );
};

const CustomLegend = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', position: 'absolute', top: '16px', left: '80px', backgroundColor: 'var(--mantle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface0)', zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '14px', height: '2px', backgroundColor: 'var(--yellow)' }}></span> LOD</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', backgroundColor: 'color-mix(in srgb, var(--yellow) 25%, transparent)', border: '1px solid var(--yellow)' }}></span> 95% CI LOD</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '14px', height: '0', borderTop: '2px dashed var(--peach)' }}></span> L_C</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '14px', height: '0', borderTop: '2px dashed var(--green)' }}></span> L_D</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '14px', height: '2px', backgroundColor: 'var(--blue)' }}></span> Model Fit</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', backgroundColor: 'color-mix(in srgb, var(--blue) 25%, transparent)', border: '1px solid var(--blue)' }}></span> 95% CI Fit</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: 'var(--red)', fontSize: '14px', lineHeight: '10px', marginLeft: '2px' }}>●</span> Measured Data</div>
    </div>
  );
};

function App() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [blankSignals, setBlankSignals] = useState(DEFAULT_BLANKS);
  const [standardRows, setStandardRows] = useState<StandardRow[]>(DEFAULT_STANDARDS);
  const [fitMethod, setFitMethod] = useState<'4pl' | '5pl' | 'auto'>('auto');
  const [plotTitle, setPlotTitle] = useState('Dose-Response Fitting');
  const [xAxisLabel, setXAxisLabel] = useState('Concentration (M)');
  const [yAxisLabel, setYAxisLabel] = useState('Signal Intensity');

  const handleDownloadPlot = () => {
    if (!chartRef.current) return;
    const svgElement = chartRef.current.querySelector('svg');
    if (!svgElement) return;

    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.style.backgroundColor = 'transparent';

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clone);

    const colors = {
      'var(--rosewater)': '#f5e0dc',
      'var(--flamingo)': '#f2cdcd',
      'var(--pink)': '#f5c2e7',
      'var(--mauve)': '#cba6f7',
      'var(--red)': '#f38ba8',
      'var(--maroon)': '#eba0ac',
      'var(--peach)': '#fab387',
      'var(--yellow)': '#f9e2af',
      'var(--green)': '#a6e3a1',
      'var(--teal)': '#94e2d5',
      'var(--sky)': '#89dceb',
      'var(--sapphire)': '#74c7ec',
      'var(--blue)': '#89b4fa',
      'var(--lavender)': '#b4befe',
      'var(--text)': '#cdd6f4',
      'var(--subtext1)': '#bac2de',
      'var(--subtext0)': '#a6adc8',
      'var(--overlay2)': '#9399b2',
      'var(--overlay1)': '#7f849c',
      'var(--overlay0)': '#6c7086',
      'var(--surface2)': '#585b70',
      'var(--surface1)': '#45475a',
      'var(--surface0)': '#313244',
      'var(--base)': '#1e1e2e',
      'var(--mantle)': '#181825',
      'var(--crust)': '#11111b'
    };
    
    for (const [v, c] of Object.entries(colors)) {
      svgString = svgString.split(v).join(c);
    }

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const DOMURL = window.URL || window.webkitURL || window;
    const url = DOMURL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 300 / 96;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = 'bioassay_plot.png';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      DOMURL.revokeObjectURL(url);
    };
    img.src = url;
  };

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
      if (i < logMax) {
        for (let j = 2; j <= 9; j++) {
          ticks.push(j * Math.pow(10, i));
        }
      }
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

  const { yDomain, yTicks } = useMemo((): { yDomain: [number | 'auto', number | 'auto'], yTicks: number[] | undefined } => {
    if (!results) return { yDomain: [0, 'auto'], yTicks: undefined };
    const maxData = Math.max(...results.fit.actualY, results.ld);
    const minData = Math.min(...results.fit.actualY, 0);
    const niceMax = Math.ceil(maxData * 1.1);
    const niceMin = Math.floor(minData);
    
    const ticks = [];
    const step = niceMax <= 5 ? 1 : Math.ceil(niceMax / 5);
    for (let i = niceMin; i <= niceMax; i += step) {
      ticks.push(i);
    }
    
    return { yDomain: [niceMin, niceMax], yTicks: ticks };
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
          <h1>Bioassay LOD Fitter v10.8.1</h1>
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
            <span className="section-title" style={{ color: 'var(--peach)' }}>Blanks</span>
            <div className="data-row"><div className="conc-input disabled" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>0</div><input type="text" className="signals-input" placeholder="Comma separated..." value={blankSignals} onChange={e => setBlankSignals(e.target.value)} /></div>
          </section>
          <section className="sidebar-section">
            <span className="section-title" style={{ color: 'var(--green)' }}>Standards</span>
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
                    <button className="action-btn" onClick={handleDownloadPlot} title="Download Plot (300 DPI, PNG)">Export PNG</button>
                  </div>
                </div>
                <div className="chart-frame" ref={chartRef} style={{ position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 25, right: 30, left: 20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--surface0)" vertical={false} />
                      <XAxis 
                        dataKey="x" type="number" scale="log" domain={['auto', 'auto']} stroke="var(--text)" 
                        ticks={xTicks}
                        tick={<CustomXAxisTick />}
                        label={{ value: xAxisLabel, position: 'bottom', fill: 'var(--overlay2)', fontSize: 11, offset: 25 }}
                      />
                      <YAxis 
                        stroke="var(--text)" 
                        domain={yDomain} 
                        ticks={yTicks}
                        allowDataOverflow={true}
                        tickFormatter={(val) => parseFloat(val.toFixed(2)).toString()}
                        label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: 'var(--overlay2)', fontSize: 11, offset: -5 }} 
                      />
                      <Tooltip contentStyle={{ backgroundColor: '#181825', borderColor: 'var(--surface0)', borderRadius: '8px', fontSize: '12px' }} />
                      <Legend verticalAlign="top" content={<CustomLegend />} />
                      
                      <Area dataKey="ciRange" stroke="none" fill="var(--blue)" fillOpacity={0.15} isAnimationActive={false} legendType="none" />
                      <ReferenceArea x1={results.lodCI.low} x2={results.lodCI.high} fill="var(--yellow)" fillOpacity={0.15} strokeOpacity={0} ifOverflow="hidden" />
                      
                      <Line dataKey="trend" stroke="var(--blue)" strokeWidth={3} dot={false} isAnimationActive={false} legendType="none" />
                      <Scatter data={scatterData} fill="var(--red)" dataKey="y" isAnimationActive={false} legendType="none" />
                      
                      <ReferenceLine y={results.lc} stroke="#fab387" strokeDasharray="4 4" label={<CustomLcLabel />} />
                      <ReferenceLine y={results.ld} stroke="#a6e3a1" strokeDasharray="4 4" label={<CustomLdLabel />} />
                      <ReferenceLine x={results.lodConc} stroke="var(--yellow)" strokeWidth={2} label={{ position: 'top', value: 'LOD', fill: 'var(--yellow)', fontSize: 10 }} />
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
            <div className="empty-prompt"><p>Loading Bioassay LOD Fitter v10.8.1...</p></div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;