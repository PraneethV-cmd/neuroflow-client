import React, { useMemo, useState, memo } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import './DataVisualizerNode.css';
import { getFull } from '../../utils/apiClient';

const width = 400;
const height = 300;
const padding = 40;

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

function createScatterPlot(points, xDomain, yDomain, xLabel, yLabel) {
  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;
  const scaleX = (x) => padding + ((x - xMin) / (xMax - xMin)) * (width - 2 * padding);
  const scaleY = (y) => height - padding - ((y - yMin) / (yMax - yMin)) * (height - 2 * padding);

  const dots = points.map((p, i) => (
    <circle key={i} cx={scaleX(p[0])} cy={scaleY(p[1])} r={3} fill="#1976d2" />
  ));

  return (
    <svg width={width} height={height}>
      <rect x="0" y="0" width={width} height={height} fill="#fff" stroke="#eee" />
      {createAxes(xDomain, yDomain, xLabel, yLabel)}
      {dots}
    </svg>
  );
}

function createHistogram(values, bins, label) {
  const maxCount = Math.max(...bins.map(bin => bin.count));
  const binWidth = (width - 2 * padding) / bins.length;
  
  const bars = bins.map((bin, i) => {
    const barHeight = (bin.count / maxCount) * (height - 2 * padding);
    const x = padding + i * binWidth;
    const y = height - padding - barHeight;
    
    return (
      <g key={i}>
        <rect 
          x={x} 
          y={y} 
          width={binWidth - 2} 
          height={barHeight} 
          fill="#1976d2" 
          stroke="#1565c0"
          strokeWidth="1"
        />
        <text 
          x={x + binWidth / 2} 
          y={height - padding + 12} 
          textAnchor="middle" 
          fontSize="10" 
          fill="#333"
        >
          {bin.range}
        </text>
      </g>
    );
  });

  return (
    <svg width={width} height={height}>
      <rect x="0" y="0" width={width} height={height} fill="#fff" stroke="#eee" />
      {createAxes([0, bins.length], [0, maxCount], label, "Frequency")}
      {bars}
    </svg>
  );
}

function createBarChart(categories, values, label) {
  const maxValue = Math.max(...values);
  const barWidth = (width - 2 * padding) / categories.length;
  
  const bars = categories.map((category, i) => {
    const barHeight = (values[i] / maxValue) * (height - 2 * padding);
    const x = padding + i * barWidth;
    const y = height - padding - barHeight;
    
    return (
      <g key={i}>
        <rect 
          x={x} 
          y={y} 
          width={barWidth - 4} 
          height={barHeight} 
          fill="#1976d2" 
          stroke="#1565c0"
          strokeWidth="1"
        />
        <text 
          x={x + barWidth / 2} 
          y={height - padding + 12} 
          textAnchor="middle" 
          fontSize="10" 
          fill="#333"
        >
          {category}
        </text>
        <text 
          x={x + barWidth / 2} 
          y={y - 5} 
          textAnchor="middle" 
          fontSize="10" 
          fill="#333"
        >
          {values[i]}
        </text>
      </g>
    );
  });

  return (
    <svg width={width} height={height}>
      <rect x="0" y="0" width={width} height={height} fill="#fff" stroke="#eee" />
      {createAxes([0, categories.length], [0, maxValue], label, "Count")}
      {bars}
    </svg>
  );
}

function DataVisualizerNode({ id, data, isConnectable }) {
  const [chartType, setChartType] = useState('scatter');
  const [xColumn, setXColumn] = useState('');
  const [yColumn, setYColumn] = useState('');
  const [histogramColumn, setHistogramColumn] = useState('');
  const [barChartColumn, setBarChartColumn] = useState('');
  
  // Find upstream CSV node
  const upstreamCsv = useStore((store) => {
    const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
    for (const e of incoming) {
      const src = store.nodeInternals.get(e.source);
      if (src?.type === 'csvReader' && src.data?.fileId && src.data?.headers) {
        return { headers: src.data.headers, file: src.data.fileId };
      }
    }
    return null;
  });

  const [vizData, setVizData] = useState({
    rows: [],
    headers: [],
    scatterPoints: [],
    histogramBins: [],
    barCategories: [],
    barValues: []
  });

  React.useEffect(() => {
    let cancelled = false;
    async function loadData() {
      if (!upstreamCsv?.file) return;
      
      const { headers, rows } = await getFull(upstreamCsv.file);
      if (!cancelled) {
        setVizData({ rows, headers, scatterPoints: [], histogramBins: [], barCategories: [], barValues: [] });
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [upstreamCsv]);

  const updateVisualization = useMemo(() => {
    if (!vizData.rows.length || !vizData.headers.length) return null;

    if (chartType === 'scatter' && xColumn && yColumn) {
      const xIndex = vizData.headers.indexOf(xColumn);
      const yIndex = vizData.headers.indexOf(yColumn);
      
      if (xIndex === -1 || yIndex === -1) return null;
      
      const points = [];
      for (const row of vizData.rows) {
        const x = parseFloat(row[xIndex]);
        const y = parseFloat(row[yIndex]);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          points.push([x, y]);
        }
      }
      
      if (points.length === 0) return null;
      
      const xs = points.map(p => p[0]);
      const ys = points.map(p => p[1]);
      const xDomain = [Math.min(...xs), Math.max(...xs)];
      const yDomain = [Math.min(...ys), Math.max(...ys)];
      
      return createScatterPlot(points, xDomain, yDomain, xColumn, yColumn);
    }
    
    if (chartType === 'histogram' && histogramColumn) {
      const colIndex = vizData.headers.indexOf(histogramColumn);
      if (colIndex === -1) return null;
      
      const values = [];
      for (const row of vizData.rows) {
        const val = parseFloat(row[colIndex]);
        if (Number.isFinite(val)) {
          values.push(val);
        }
      }
      
      if (values.length === 0) return null;
      
      const min = Math.min(...values);
      const max = Math.max(...values);
      const numBins = Math.min(10, Math.ceil(Math.sqrt(values.length)));
      const binSize = (max - min) / numBins;
      
      const bins = Array(numBins).fill().map((_, i) => ({
        range: `${(min + i * binSize).toFixed(1)}-${(min + (i + 1) * binSize).toFixed(1)}`,
        count: 0,
        min: min + i * binSize,
        max: min + (i + 1) * binSize
      }));
      
      values.forEach(val => {
        const binIndex = Math.min(Math.floor((val - min) / binSize), numBins - 1);
        bins[binIndex].count++;
      });
      
      return createHistogram(values, bins, histogramColumn);
    }
    
    if (chartType === 'bar' && barChartColumn) {
      const colIndex = vizData.headers.indexOf(barChartColumn);
      if (colIndex === -1) return null;
      
      const categoryCount = {};
      for (const row of vizData.rows) {
        const category = String(row[colIndex]).trim();
        if (category) {
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        }
      }
      
      const categories = Object.keys(categoryCount);
      const values = Object.values(categoryCount);
      
      if (categories.length === 0) return null;
      
      return createBarChart(categories, values, barChartColumn);
    }
    
    return null;
  }, [chartType, xColumn, yColumn, histogramColumn, barChartColumn, vizData]);

  const hasData = upstreamCsv && vizData.headers.length > 0;

  return (
    <div className="data-visualizer-node">
      <div className="dv-title">Data Visualizer</div>
      
      {hasData && (
        <div className="dv-controls">
          <div className="dv-chart-type">
            <label>Chart Type:</label>
            <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
              <option value="scatter">Scatter Plot</option>
              <option value="histogram">Histogram</option>
              <option value="bar">Bar Chart</option>
            </select>
          </div>
          
          {chartType === 'scatter' && (
            <>
              <div className="dv-column-select">
                <label>X Axis:</label>
                <select value={xColumn} onChange={(e) => setXColumn(e.target.value)}>
                  <option value="">Select column</option>
                  {vizData.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div className="dv-column-select">
                <label>Y Axis:</label>
                <select value={yColumn} onChange={(e) => setYColumn(e.target.value)}>
                  <option value="">Select column</option>
                  {vizData.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          
          {chartType === 'histogram' && (
            <div className="dv-column-select">
              <label>Column:</label>
              <select value={histogramColumn} onChange={(e) => setHistogramColumn(e.target.value)}>
                <option value="">Select column</option>
                {vizData.headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          )}
          
          {chartType === 'bar' && (
            <div className="dv-column-select">
              <label>Column:</label>
              <select value={barChartColumn} onChange={(e) => setBarChartColumn(e.target.value)}>
                <option value="">Select column</option>
                {vizData.headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
      
      <div className="dv-content">
        {updateVisualization || (
          <div className="dv-placeholder">
            {hasData ? 'Select chart type and columns to visualize' : 'Connect a CSV node to visualize data'}
          </div>
        )}
      </div>
      
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

export default memo(DataVisualizerNode);
