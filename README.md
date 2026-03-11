# Concentration-Response Curve LOD Calculator

Concentration-Response Curve LOD Calculator is a professional-grade web application built to analyze dose-response data, perform advanced sigmoidal curve fitting, and rigorously calculate the Limit of Detection (LOD) for biological and chemical assays.

**[Launch Concentration-Response Curve LOD Calculator](https://akshamsabadi.github.io/lod-calculator/)**

## Overview & Functionality

This tool provides an intuitive interface for inputting experimental data (blanks and standard concentrations with their corresponding signal readouts) and instantly visualizing the fitted dose-response curve.

### Key Features
* **Interactive Data Entry:** Easily add, edit, or remove calibration standards and blank measurements.
* **Advanced Curve Fitting:** Automatically selects between 4-Parameter Logistic (4PL) and 5-Parameter Logistic (5PL) curve models using the Akaike Information Criterion (AICc) to ensure the most statistically sound fit, while still allowing the user to manually force a specific model.
* **Rich Visualization:** A responsive, interactive logarithmic plot displays the data points, the modeled curve, the 95% confidence interval (CI) for the fit, and visually highlights the critical limits (L_C, L_D, and LOD).
* **High-Resolution Export:** Download your generated plot as a publication-ready, 300 DPI transparent PNG with a single click.
* **Modern Aesthetic:** Built with the Catppuccin color palette for a clean, accessible, and beautiful user interface.

## Understanding the Plot

The main chart provides a comprehensive overview of your assay's performance:

* **Measured Data (●):** Your raw, experimental data points.
* **Model Fit (—):** The calculated 4PL or 5PL regression curve.
* **95% CI Fit (■):** The shaded region around the curve representing the 95% confidence interval of the model's prediction.
* **L_C (Critical Level):** Indicated by a dashed peach line. This is the signal threshold above which an observed response is statistically considered to be distinct from the background noise (blanks).
* **L_D (Limit of Detection - Signal):** Indicated by a dashed green line. This is the true signal level at which there is a high probability (typically 95%) of detecting the analyte, guarding against false negatives.
* **LOD (Limit of Detection - Concentration):** Indicated by a solid yellow vertical line. This is the final calculated concentration corresponding to the L_D signal on the fitted curve.
* **95% CI LOD (■):** A yellow shaded area along the X-axis indicating the confidence interval for the calculated LOD concentration.

## The LOD Calculation Methodology

This application employs a rigorous, clinically validated approach to calculating the Limit of Detection, stepping away from simplistic (and often overly optimistic) linear approximations.

### Why this method?
Many basic tools calculate LOD as simply `3 * Standard Deviation of Blanks`. While useful as a rough estimate for highly linear, low-noise systems, this approach is often inadequate for complex biological assays characterized by non-linear (sigmoidal) responses and heteroscedastic noise (variance that changes with concentration).

Concentration-Response Curve LOD Calculator utilizes a more robust statistical framework:

1. **Calculate L_C (Critical Level):** 
   `L_C = Mean_Blanks + (t-value * Standard_Deviation_Blanks)`
   This establishes the noise floor.
2. **Calculate L_D (Detection Limit Signal):**
   `L_D = L_C + (t-value * Standard_Deviation_Low_Standards)`
   This accounts for the variance not just at zero, but at low concentrations where the LOD actually resides.
3. **Non-Linear Interpolation:**
   The L_D signal is then mapped back through the rigorously fitted 4PL or 5PL sigmoidal equation to determine the exact corresponding concentration (the true LOD).

This methodology ensures that the reported LOD is a realistic, statistically defensible metric representing the lowest concentration that can be reliably detected with a stated probability (typically 95%), making it suitable for clinical and high-stakes research applications.

## Development

This project is built with:
* [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
* [Vite](https://vitejs.dev/)
* [Recharts](https://recharts.org/) for data visualization
* [ml-levenberg-marquardt](https://github.com/mljs/levenberg-marquardt) for non-linear regression

### Running Locally
```bash
npm install
npm run dev
```

### Deployment
Deployment to GitHub pages is handled via `npm run deploy` (which runs `gh-pages -d dist`).
