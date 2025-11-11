import React, { useMemo, useState, useCallback, memo } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './LinearRegressionNode.css';
import { FaChartLine, FaCog } from 'react-icons/fa';
import { trainLinear } from '../../utils/apiClient';

const LinearRegressionNode = ({ id, data, isConnectable }) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [config, setConfig] = useState({
    learningRate: 0.01,
    maxIterations: 1000,
    regularization: 'none',
    alpha: 0.1
  });
  const [xCol, setXCol] = useState('');
  const [yCol, setYCol] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState('');
  const { setNodes } = useReactFlow();

  // Inspect incoming edge to find the upstream CSV node or Encoder node
  const upstreamData = useStore((store) => {
    const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
    if (incoming.length === 0) return null;
    for (const e of incoming) {
      const src = store.nodeInternals.get(e.source);
      if (src?.type === 'csvReader') {
        return { 
          type: 'csv',
          headers: src.data?.headers || [],
          fileId: src.data?.fileId
        };
      }
      if (src?.type === 'encoder') {
        return { 
          type: 'encoded', 
          headers: src.data?.headers || [], 
          encodedRows: src.data?.encodedRows || [],
          encodingInfo: src.data?.encodingInfo || {}
        };
      }
      if (src?.type === 'normalizer') {
        return { 
          type: 'normalized', 
          headers: src.data?.headers || [], 
          normalizedRows: src.data?.normalizedRows || [],
          normalizationInfo: src.data?.normalizationInfo || {}
        };
      }
    }
    return null;
  });

  const headers = useMemo(() => upstreamData?.headers || [], [upstreamData]);

  const toggleConfig = useCallback(() => {
    setIsConfigOpen((v) => !v);
  }, []);

  const onRun = useCallback(async () => {
    setTrainMsg('');
    if (!upstreamData) {
      alert('Please connect a CSV/Excel node or Encoder node.');
      return;
    }
    if (!xCol || !yCol) {
      alert('Please select both independent (X) and dependent (Y) columns.');
      return;
    }
    setIsTraining(true);
    try {
      // Expect upstreamData to contain fileId for backend
      if (upstreamData.type !== 'csv') {
        throw new Error('Please connect a CSV/Excel node (backend-backed).');
      }
      const ll = await trainLinear({ fileId: upstreamData.fileId, xCol, yCol });
      const slope = ll.slope;
      const intercept = ll.intercept;

      setTrainMsg(`Training complete. y = ${slope.toFixed(4)} x + ${intercept.toFixed(4)}`);
      // Persist model info on this node's data for downstream nodes (visualizer)
      setNodes((nds) => nds.map((n) => {
        if (n.id !== id) return n;
        return { ...n, data: { ...n.data, model: { slope, intercept, xCol, yCol } } };
      }));
      alert('Linear Regression training finished.');
    } catch (err) {
      setTrainMsg(err?.message || 'Training failed.');
    } finally {
      setIsTraining(false);
    }
  }, [headers, id, setNodes, upstreamData, xCol, yCol]);

  return (
    <div className="linear-regression-node">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ background: '#555' }}
      />
      
      <div className="node-header">
        <FaChartLine className="node-icon" />
        <span className="node-title">{data.label}</span>
        <button className="config-button" onClick={toggleConfig}>
          <FaCog className={`gear-icon ${isConfigOpen ? 'rotating' : ''}`} />
        </button>
      </div>

      {headers.length > 0 && (
        <div className="lr-selects">
          <div className="lr-row">
            <label>Independent (X):</label>
            <select value={xCol} onChange={(e) => setXCol(e.target.value)}>
              <option value="">Select column</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <div className="lr-row">
            <label>Dependent (Y):</label>
            <select value={yCol} onChange={(e) => setYCol(e.target.value)}>
              <option value="">Select column</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <div className="lr-actions">
            <button className="btn primary" onClick={onRun} disabled={isTraining}> {isTraining ? 'Running…' : 'Run'} </button>
          </div>
          {trainMsg && <div className="lr-msg">{trainMsg}</div>}
        </div>
      )}

      {isConfigOpen && (
        <div className="config-panel">
          <div className="config-section">
            <label>Learning Rate:</label>
            <input
              type="number"
              value={config.learningRate}
              onChange={(e) => setConfig({...config, learningRate: parseFloat(e.target.value)})}
              step="0.001"
              min="0"
              max="1"
            />
          </div>
          
          <div className="config-section">
            <label>Max Iterations:</label>
            <input
              type="number"
              value={config.maxIterations}
              onChange={(e) => setConfig({...config, maxIterations: parseInt(e.target.value)})}
              min="1"
              max="10000"
            />
          </div>

          <div className="config-section">
            <label>Regularization:</label>
            <select
              value={config.regularization}
              onChange={(e) => setConfig({...config, regularization: e.target.value})}
            >
              <option value="none">None</option>
              <option value="l1">L1 (Lasso)</option>
              <option value="l2">L2 (Ridge)</option>
              <option value="elastic">Elastic Net</option>
            </select>
          </div>

          {config.regularization !== 'none' && (
            <div className="config-section">
              <label>Alpha:</label>
              <input
                type="number"
                value={config.alpha}
                onChange={(e) => setConfig({...config, alpha: parseFloat(e.target.value)})}
                step="0.01"
                min="0"
                max="1"
              />
            </div>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ background: '#555' }}
      />
    </div>
  );
};

export default memo(LinearRegressionNode);
