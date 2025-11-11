import React, { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import { listModels, trainGeneric } from '../../utils/apiClient';

const GenericModelNode = ({ id, data, isConnectable }) => {
  const { setNodes } = useReactFlow();
  const [models, setModels] = useState({});
  const [selectedModel, setSelectedModel] = useState('');
  const [paramsText, setParamsText] = useState('{}');
  const [isTraining, setIsTraining] = useState(false);
  const [msg, setMsg] = useState('');
  const [result, setResult] = useState(null);

  const upstream = useStore((store) => {
    const incoming = Array.from(store.edges.values()).filter((e) => e.target === id);
    for (const e of incoming) {
      const src = store.nodeInternals.get(e.source);
      if (src?.type === 'csvReader') {
        return { fileId: src.data?.fileId, headers: src.data?.headers || [] };
      }
    }
    return null;
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await listModels();
        if (!cancelled) setModels(res.models || {});
      } catch {
        if (!cancelled) setModels({});
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const onRun = useCallback(async () => {
    setMsg('');
    setResult(null);
    if (!upstream?.fileId) {
      setMsg('Please connect a CSV node with uploaded file.');
      return;
    }
    if (!selectedModel) {
      setMsg('Please select a model.');
      return;
    }
    let params = {};
    try {
      params = JSON.parse(paramsText || '{}');
    } catch {
      setMsg('Invalid JSON in params.');
      return;
    }
    setIsTraining(true);
    try {
      const out = await trainGeneric({ model: selectedModel, fileId: upstream.fileId, params });
      setResult(out);
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, modelResult: out } } : n)));
      setMsg('Training finished.');
    } catch (e) {
      setMsg(e?.message || 'Training failed.');
    } finally {
      setIsTraining(false);
    }
  }, [id, paramsText, selectedModel, setNodes, upstream]);

  const modelOptions = useMemo(() => Object.keys(models || {}), [models]);

  return (
    <div className="linear-regression-node">
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#555' }} />
      <div className="node-header">
        <span className="node-title">{data.label || 'Generic Model'}</span>
      </div>
      <div className="lr-selects">
        <div className="lr-row">
          <label>Model:</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="">Select model</option>
            {modelOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="lr-row">
          <label>Params (JSON):</label>
          <textarea
            value={paramsText}
            onChange={(e) => setParamsText(e.target.value)}
            rows={6}
            style={{ width: '100%' }}
            placeholder='{"xCol":"feature","yCol":"target"}'
          />
        </div>
        <div className="lr-actions">
          <button className="btn primary" onClick={onRun} disabled={isTraining}>
            {isTraining ? 'Running…' : 'Run'}
          </button>
        </div>
        {msg && <div className="lr-msg">{msg}</div>}
        {result && (
          <pre style={{ maxHeight: 160, overflow: 'auto', background: '#fafafa', padding: 8 }}>
{JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#555' }} />
    </div>
  );
};

export default memo(GenericModelNode);


