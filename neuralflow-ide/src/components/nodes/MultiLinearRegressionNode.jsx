import React, { useMemo, useState, useCallback, memo } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import './LinearRegressionNode.css';
import { trainMultiLinear } from '../../utils/apiClient';
import { transpose, multiply, invert } from '../../utils/linearAlgebra';

const MultiLinearRegressionNode = ({ id, data, isConnectable }) => {
  const [selectedX, setSelectedX] = useState([]);
  const [yCol, setYCol] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState('');
  const { setNodes } = useReactFlow();

  const upstreamData = useStore((store) => {
    const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
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

  const toggleX = useCallback((h) => {
    setSelectedX((prev) => (prev.includes(h) ? prev.filter((c) => c !== h) : [...prev, h]));
  }, []);

  const onRun = useCallback(async () => {
    setTrainMsg('');
    if (!upstreamData) {
      alert('Please connect a CSV/Excel node or Encoder node.');
      return;
    }
    if (selectedX.length === 0 || !yCol) {
      alert('Please select at least one independent column and one dependent column.');
      return;
    }
    setIsTraining(true);
    try {
      if (upstreamData.type !== 'csv') {
        throw new Error('Please connect a CSV/Excel node (backend-backed).');
      }
      const result = await trainMultiLinear({ fileId: upstreamData.fileId, xCols: selectedX, yCol });
      const intercept = result.intercept;
      const coefficients = result.coefficients;
      const parts = coefficients.map((c, i) => `${c.toFixed(4)}*${selectedX[i]}`);
      setTrainMsg(`Done. y = ${intercept.toFixed(4)} + ${parts.join(' + ')}`);

      setNodes((nds) => nds.map((n) => {
        if (n.id !== id) return n;
        return { ...n, data: { ...n.data, model: { intercept, coefficients, xCols: selectedX, yCol } } };
      }));
      alert('Multi Linear Regression training finished.');
    } catch (err) {
      setTrainMsg(err?.message || 'Training failed.');
    } finally {
      setIsTraining(false);
    }
  }, [headers, id, selectedX, setNodes, upstreamData, yCol]);

  return (
    <div className="linear-regression-node">
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />

      <div className="node-header">
        <span className="node-title">{data.label || 'Multi Linear Regression'}</span>
      </div>

      {headers.length > 0 && (
        <div className="lr-selects">
          <div className="lr-row">
            <label>Independent (X columns):</label>
            <div className="mlr-columns">
              {headers.map((h) => (
                <label key={h} className="mlr-option">
                  <input type="checkbox" checked={selectedX.includes(h)} onChange={() => toggleX(h)} />
                  <span>{h}</span>
                </label>
              ))}
            </div>
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

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#555' }} />
    </div>
  );
};

export default memo(MultiLinearRegressionNode);


