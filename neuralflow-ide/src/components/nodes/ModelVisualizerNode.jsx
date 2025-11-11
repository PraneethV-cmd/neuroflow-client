import React, { useMemo, memo } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import './ModelVisualizerNode.css';
import { getFull } from '../../utils/apiClient';

const width = 400;
const height = 300;
const padding = 40;

function calculateRSquared(actual, predicted) {
  const actualMean = actual.reduce((a, b) => a + b, 0) / actual.length;
  const ssRes = actual.reduce((sum, y, i) => sum + Math.pow(y - predicted[i], 2), 0);
  const ssTot = actual.reduce((sum, y) => sum + Math.pow(y - actualMean, 2), 0);
  return 1 - (ssRes / ssTot);
}

function scatterAndLine(points, slope, intercept, xDomain, yDomain, showResiduals = false) {
  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;
  const scaleX = (x) => padding + ((x - xMin) / (xMax - xMin)) * (width - 2 * padding);
  const scaleY = (y) => height - padding - ((y - yMin) / (yMax - yMin)) * (height - 2 * padding);

  const dots = points.map((p, i) => (
    <circle key={i} cx={scaleX(p[0])} cy={scaleY(p[1])} r={3} fill="#1976d2" />
  ));

  const x1 = xMin;
  const y1 = slope * x1 + intercept;
  const x2 = xMax;
  const y2 = slope * x2 + intercept;

  const line = (
    <line x1={scaleX(x1)} y1={scaleY(y1)} x2={scaleX(x2)} y2={scaleY(y2)} stroke="#d32f2f" strokeWidth="2" />
  );

  // Add residual lines if requested
  const residualLines = showResiduals ? points.map((p, i) => {
    const predicted = slope * p[0] + intercept;
    return (
      <line 
        key={`residual-${i}`} 
        x1={scaleX(p[0])} 
        y1={scaleY(p[1])} 
        x2={scaleX(p[0])} 
        y2={scaleY(predicted)} 
        stroke="#ff9800" 
        strokeWidth="1" 
        strokeDasharray="2,2"
        opacity="0.6"
      />
    );
  }) : [];

  return { dots, line, residualLines };
}

function createAxes(xDomain, yDomain, xLabel, yLabel) {
  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;
  const scaleX = (x) => padding + ((x - xMin) / (xMax - xMin)) * (width - 2 * padding);
  const scaleY = (y) => height - padding - ((y - yMin) / (yMax - yMin)) * (height - 2 * padding);

  // X-axis
  const xAxis = (
    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#333" strokeWidth="1" />
  );

  // Y-axis
  const yAxis = (
    <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#333" strokeWidth="1" />
  );

  // X-axis ticks and labels
  const xTicks = [];
  const xStep = (xMax - xMin) / 5;
  for (let i = 0; i <= 5; i++) {
    const x = xMin + i * xStep;
    const xPos = scaleX(x);
    xTicks.push(
      <g key={`x-tick-${i}`}>
        <line x1={xPos} y1={height - padding} x2={xPos} y2={height - padding + 5} stroke="#333" />
        <text x={xPos} y={height - padding + 15} textAnchor="middle" fontSize="10" fill="#333">
          {x.toFixed(1)}
        </text>
      </g>
    );
  }

  // Y-axis ticks and labels
  const yTicks = [];
  const yStep = (yMax - yMin) / 5;
  for (let i = 0; i <= 5; i++) {
    const y = yMin + i * yStep;
    const yPos = scaleY(y);
    yTicks.push(
      <g key={`y-tick-${i}`}>
        <line x1={padding} y1={yPos} x2={padding - 5} y2={yPos} stroke="#333" />
        <text x={padding - 10} y={yPos + 3} textAnchor="end" fontSize="10" fill="#333">
          {y.toFixed(1)}
        </text>
      </g>
    );
  }

  return (
    <g>
      {xAxis}
      {yAxis}
      {xTicks}
      {yTicks}
      <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="12" fill="#333">
        {xLabel}
      </text>
      <text x={10} y={height / 2} textAnchor="middle" fontSize="12" fill="#333" transform={`rotate(-90, 10, ${height / 2})`}>
        {yLabel}
      </text>
    </g>
  );
}

function ModelVisualizerNode({ id, data, isConnectable }) {
  const [showResiduals, setShowResiduals] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('scatter');
  
  // Walk upstream graph to find linearRegression (with model) and csvReader (with data)
  const upstream = useStore((store) => {
    const edges = Array.from(store.edges.values());
    const nodes = store.nodeInternals;
    const visited = new Set();
    const stack = [id];
    const result = { model: null, csv: null };
    while (stack.length) {
      const targetId = stack.pop();
      if (visited.has(targetId)) continue;
      visited.add(targetId);
      const incoming = edges.filter((e) => e.target === targetId);
      for (const e of incoming) {
        const src = nodes.get(e.source);
        if (!src) continue;
        // capture model from linear regression or multi-linear regression
        if (!result.model && (src.type === 'linearRegression' || src.type === 'multiLinearRegression') && src.data?.model) {
          result.model = { ...src.data.model, type: src.type };
        }
        // capture csv
        if (!result.csv && src.type === 'csvReader' && src.data?.fileId && src.data?.headers) {
          result.csv = { file: src.data.fileId, headers: src.data.headers };
        }
        // continue walking upstream until we found both
        if (!(result.model && result.csv)) {
          stack.push(src.id);
        }
      }
      if (result.model && result.csv) break;
    }
    return result;
  });

  const [viz, setViz] = React.useState({ 
    points: [], 
    xDomain: [0, 1], 
    yDomain: [0, 1],
    metrics: { rSquared: 0, mse: 0, mae: 0 },
    residuals: []
  });

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!upstream.model || !upstream.csv) return;
      const { headers, file } = upstream.csv;
      const { xCol, yCol, type } = upstream.model;
      if (!xCol || !yCol) return;
      
      const { headers: hs, rows } = await getFull(file);
      const xi = hs.indexOf(xCol);
      const yi = hs.indexOf(yCol);
      if (xi === -1 || yi === -1) return;
      
      const pts = [];
      const actual = [];
      const predicted = [];
      
      for (const r of rows) {
        const xv = parseFloat(r[xi]);
        const yv = parseFloat(r[yi]);
        if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
        
        pts.push([xv, yv]);
        actual.push(yv);
        
        // Calculate predicted value based on model type
        let pred;
        if (type === 'linearRegression') {
          const { slope, intercept } = upstream.model;
          pred = slope * xv + intercept;
        } else if (type === 'multiLinearRegression') {
          const { intercept, coefficients, xCols } = upstream.model;
          pred = intercept;
          xCols.forEach((col, i) => {
            const colIndex = hs.indexOf(col);
            if (colIndex !== -1) {
              const val = parseFloat(r[colIndex]);
              if (Number.isFinite(val)) {
                pred += coefficients[i] * val;
              }
            }
          });
        }
        predicted.push(pred);
      }
      
      if (pts.length < 2) return;
      
      // Calculate metrics
      const rSquared = calculateRSquared(actual, predicted);
      const mse = actual.reduce((sum, y, i) => sum + Math.pow(y - predicted[i], 2), 0) / actual.length;
      const mae = actual.reduce((sum, y, i) => sum + Math.abs(y - predicted[i]), 0) / actual.length;
      
      // Calculate residuals
      const residuals = actual.map((y, i) => y - predicted[i]);
      
      const xs = pts.map(p => p[0]);
      const ys = pts.map(p => p[1]);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      
      if (!cancelled) {
        setViz({ 
          points: pts, 
          xDomain: [xMin, xMax], 
          yDomain: [yMin, yMax],
          metrics: { rSquared, mse, mae },
          residuals
        });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [upstream]);

  const hasEverything = upstream.model && upstream.csv && viz.points.length > 0;
  
  const scatterPlot = useMemo(() => {
    if (!hasEverything) return null;
    const { slope, intercept, type, xCol, yCol } = upstream.model;
    
    // For multi-linear regression, we can't show a simple 2D plot, so show residuals plot instead
    if (type === 'multiLinearRegression') {
      const residuals = viz.residuals;
      const xDomain = [0, residuals.length - 1];
      const yMin = Math.min(...residuals);
      const yMax = Math.max(...residuals);
      const yDomain = [yMin - (yMax - yMin) * 0.1, yMax + (yMax - yMin) * 0.1];
      
      const residualPoints = residuals.map((res, i) => [i, res]);
      const { dots } = scatterAndLine(residualPoints, 0, 0, xDomain, yDomain);
      
      return (
        <svg width={width} height={height}>
          <rect x="0" y="0" width={width} height={height} fill="#fff" stroke="#eee" />
          {createAxes(xDomain, yDomain, "Data Point Index", "Residuals")}
          {dots}
          <line x1={padding} y1={height - padding - (0 - yDomain[0]) / (yDomain[1] - yDomain[0]) * (height - 2 * padding)} 
                x2={width - padding} y2={height - padding - (0 - yDomain[0]) / (yDomain[1] - yDomain[0]) * (height - 2 * padding)} 
                stroke="#d32f2f" strokeWidth="1" strokeDasharray="5,5" />
        </svg>
      );
    }
    
    // Regular linear regression scatter plot
    const xr = viz.xDomain[0] === viz.xDomain[1]
      ? [viz.xDomain[0] - 1, viz.xDomain[1] + 1]
      : viz.xDomain;
    const yr = viz.yDomain[0] === viz.yDomain[1]
      ? [viz.yDomain[0] - 1, viz.yDomain[1] + 1]
      : viz.yDomain;
    
    const { dots, line, residualLines } = scatterAndLine(viz.points, slope, intercept, xr, yr, showResiduals);
    
    return (
      <svg width={width} height={height}>
        <rect x="0" y="0" width={width} height={height} fill="#fff" stroke="#eee" />
        {createAxes(xr, yr, xCol, yCol)}
        {dots}
        {line}
        {residualLines}
      </svg>
    );
  }, [hasEverything, upstream, viz, showResiduals]);

  const residualsPlot = useMemo(() => {
    if (!hasEverything) return null;
    
    const residuals = viz.residuals;
    const xDomain = [0, residuals.length - 1];
    const yMin = Math.min(...residuals);
    const yMax = Math.max(...residuals);
    const yDomain = [yMin - (yMax - yMin) * 0.1, yMax + (yMax - yMin) * 0.1];
    
    const residualPoints = residuals.map((res, i) => [i, res]);
    const { dots } = scatterAndLine(residualPoints, 0, 0, xDomain, yDomain);
    
    return (
      <svg width={width} height={height}>
        <rect x="0" y="0" width={width} height={height} fill="#fff" stroke="#eee" />
        {createAxes(xDomain, yDomain, "Data Point Index", "Residuals")}
        {dots}
        <line x1={padding} y1={height - padding - (0 - yDomain[0]) / (yDomain[1] - yDomain[0]) * (height - 2 * padding)} 
              x2={width - padding} y2={height - padding - (0 - yDomain[0]) / (yDomain[1] - yDomain[0]) * (height - 2 * padding)} 
              stroke="#d32f2f" strokeWidth="1" strokeDasharray="5,5" />
      </svg>
    );
  }, [hasEverything, viz]);

  return (
    <div className="model-visualizer-node">
      <div className="mv-title">Model Visualizer</div>
      
      {hasEverything && (
        <div className="mv-controls">
          <div className="mv-tabs">
            <button 
              className={`mv-tab ${activeTab === 'scatter' ? 'active' : ''}`}
              onClick={() => setActiveTab('scatter')}
            >
              Scatter Plot
            </button>
            <button 
              className={`mv-tab ${activeTab === 'residuals' ? 'active' : ''}`}
              onClick={() => setActiveTab('residuals')}
            >
              Residuals
            </button>
          </div>
          
          {upstream.model.type === 'linearRegression' && (
            <label className="mv-checkbox">
              <input 
                type="checkbox" 
                checked={showResiduals}
                onChange={(e) => setShowResiduals(e.target.checked)}
              />
              Show Residual Lines
            </label>
          )}
        </div>
      )}
      
      <div className="mv-content">
        {hasEverything ? (
          activeTab === 'scatter' ? scatterPlot : residualsPlot
        ) : (
          <div className="mv-placeholder">Connect Linear Regression (trained) and CSV nodes</div>
        )}
      </div>
      
      {hasEverything && (
        <div className="mv-metrics">
          <div className="metric">
            <span className="metric-label">R²:</span>
            <span className="metric-value">{viz.metrics.rSquared.toFixed(4)}</span>
          </div>
          <div className="metric">
            <span className="metric-label">MSE:</span>
            <span className="metric-value">{viz.metrics.mse.toFixed(4)}</span>
          </div>
          <div className="metric">
            <span className="metric-label">MAE:</span>
            <span className="metric-value">{viz.metrics.mae.toFixed(4)}</span>
          </div>
        </div>
      )}
      
      <Handle 
        type="target" 
        position={Position.Top} 
        isConnectable={isConnectable}
        className="custom-handle"
        id="target-top"
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={isConnectable}
        className="custom-handle"
        id="target-left"
      />
    </div>
  );
}

export default memo(ModelVisualizerNode);


