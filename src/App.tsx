import { useState } from 'react';
import { calculateAdvancedLoD, type StandardData } from './utils/calculations';
import './App.css';

function App() {
  const [blanksInput, setBlanksInput] = useState('');
  const [standardsInput, setStandardsInput] = useState('');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const handleCalculate = () => {
    setError('');
    
    // Parse Blanks
    const blanks = blanksInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '')
      .map(Number);

    // Parse Standards (Expected format: conc:readout, conc:readout)
    const standards: StandardData[] = standardsInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '')
      .map(pair => {
        const [conc, readout] = pair.split(':').map(Number);
        return { concentration: conc, readout: readout };
      });

    if (blanks.some(isNaN) || standards.some(s => isNaN(s.concentration) || isNaN(s.readout))) {
      setError('Invalid input. Use numbers for blanks, and "conc:readout" for standards.');
      return;
    }

    if (blanks.length < 2 || standards.length < 2) {
      setError('Please provide at least 2 data points for both blanks and standards.');
      return;
    }

    const res = calculateAdvancedLoD(blanks, standards);
    setResults(res);
  };

  return (
    <div className="container">
      <h1>Advanced LoD Calculator</h1>
      <p className="subtitle">Clinical Assay Validation (CLSI EP17-A2)</p>
      
      <div className="input-sections">
        <section className="input-card">
          <h3>1. Blank Samples (Signal)</h3>
          <p>Enter readout values for zero-concentration samples.</p>
          <textarea
            value={blanksInput}
            onChange={(e) => setBlanksInput(e.target.value)}
            placeholder="e.g. 0.1, 0.12, 0.09"
            rows={3}
          />
        </section>

        <section className="input-card">
          <h3>2. Standards (Conc : Signal)</h3>
          <p>Enter concentration and readout pairs.</p>
          <textarea
            value={standardsInput}
            onChange={(e) => setStandardsInput(e.target.value)}
            placeholder="e.g. 10:1.2, 50:4.5, 100:8.9"
            rows={3}
          />
        </section>
      </div>

      <button className="calc-btn" onClick={handleCalculate}>Perform Clinical Analysis</button>

      {error && <div className="error">{error}</div>}

      {results && (
        <div className="results-container">
          <h2>Validation Results</h2>
          <div className="result-grid">
            <div className="result-item">
              <label>Limit of Blank (L<sub>C</sub>)</label>
              <span className="value">{results.lc.toFixed(4)}</span>
              <small>Signal Threshold</small>
            </div>
            <div className="result-item">
              <label>Limit of Detection (L<sub>D</sub>)</label>
              <span className="value">{results.ld.toFixed(4)}</span>
              <small>Signal LoD</small>
            </div>
            <div className="result-item highlight">
              <label>Final LoD (Concentration)</label>
              <span className="value">{results.lodConc.toFixed(4)}</span>
              <small>Calculated via Linear Fit</small>
            </div>
          </div>

          <div className="details-box">
            <h4>Fit Parameters (y = mx + b)</h4>
            <p>Slope (m): {results.m.toFixed(4)} | Intercept (b): {results.b.toFixed(4)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
