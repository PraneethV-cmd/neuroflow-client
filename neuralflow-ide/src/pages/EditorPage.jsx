import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  SmoothStepEdge,
  useViewport,
} from 'reactflow';
import 'reactflow/dist/style.css';

import TopToolbar from '../components/ui/TopToolbar';
import BottomToolbar from '../components/ui/BottomToolbar';
import Sidebar from '../components/ui/Sidebar';
import CsvReaderNode from '../components/nodes/CsvReaderNode';
import LinearRegressionNode from '../components/nodes/LinearRegressionNode';
import MultiLinearRegressionNode from '../components/nodes/MultiLinearRegressionNode';
import DataCleanerNode from '../components/nodes/DataCleanerNode';
import BasicNode from '../components/nodes/BasicNode';
import StartNode from '../components/nodes/StartNode';
import ModelVisualizerNode from '../components/nodes/ModelVisualizerNode';
import EncoderNode from '../components/nodes/EncoderNode';
import NormalizerNode from '../components/nodes/NormalizerNode';
import DataVisualizerNode from '../components/nodes/DataVisualizerNode';
import GenericModelNode from '../components/nodes/GenericModelNode';
import FloatingEdge from '../components/edges/FloatingEdge';
import './EditorPage.css';

const nodeTypes = {
  // Existing specialized nodes
  start: StartNode,
  csvReader: CsvReaderNode,
  linearRegression: LinearRegressionNode,
  multiLinearRegression: MultiLinearRegressionNode,
  dataCleaner: DataCleanerNode,
  modelVisualizer: ModelVisualizerNode,
  encoder: EncoderNode,
  normalizer: NormalizerNode,
  dataVisualizer: DataVisualizerNode,
  genericModel: GenericModelNode,
  // Generic/basic nodes for all other sidebar items
  excelReader: BasicNode,
  databaseReader: BasicNode,
  scaler: BasicNode,
  featureSelector: BasicNode,
  polynomialRegression: BasicNode,
  ridgeRegression: BasicNode,
  lassoRegression: BasicNode,
  kMeans: BasicNode,
  hierarchicalClustering: BasicNode,
  dbscan: BasicNode,
  mlp: BasicNode,
  cnn: BasicNode,
  rnn: BasicNode,
  transformer: BasicNode,
  evaluator: BasicNode,
  visualizer: BasicNode,
  exporter: BasicNode,
};
const edgeTypes = {
  floating: FloatingEdge,
};

let id = 1;
const getId = () => `node_${id++}`; // Corrected this line

const EditorPage = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes] = useState([
    {
      id: 'node_0',
      type: 'start',
      position: { x: 300, y: 300 },
      data: { label: 'Start' },
    },
  ]);
  const [edges, setEdges] = useState([]);
  const reactFlowInstanceRef = useRef(null);

  const [activeTool, setActiveTool] = useState('select');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);

  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  const isValidConnection = useCallback((connection) => {
    if (connection.source === connection.target) return false;
    return true;
  }, []);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    const nodeName = event.dataTransfer.getData('application/reactflow-name');
    if (typeof type === 'undefined' || !type) return;
    const instance = reactFlowInstanceRef.current;
    if (!instance) return;
    const position = instance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const newNode = {
      id: getId(),
      type,
      position,
      data: {
        label: nodeName || `New Node`,
        nodeType: type
      }
    };
    setNodes((nds) => nds.concat(newNode));
  }, []);

  const addDefaultNode = useCallback(() => {
    const newNode = {
      id: getId(),
      type: 'csvReader',
      position: { x: 50 + Math.random() * 400, y: 50 + Math.random() * 400 },
      data: { label: `New Node ${id}` },
    };
    setNodes((nds) => nds.concat(newNode));
    fitView();
  }, [fitView]);

  const handleMenuClick = useCallback(() => {
    if (sidebarOpen) {
      setSidebarClosing(true);
      setTimeout(() => {
        setSidebarOpen(false);
        setSidebarClosing(false);
      }, 300); // Match animation duration
    } else {
      setSidebarOpen(true);
    }
  }, [sidebarOpen]);

  return (
    <div className={`editor-container-new ${activeTool === 'pan' ? 'pan-active' : ''}`}>
      <TopToolbar activeTool={activeTool} setActiveTool={setActiveTool} onMenuClick={handleMenuClick} />
      {sidebarOpen && <Sidebar className={sidebarClosing ? 'slide-out' : ''} />}
      
      <div className="canvas-area">
        <div className="reactflow-wrapper-new" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => setNodes((nds) => applyNodeChanges(changes, nds))}
            onEdgesChange={(changes) => setEdges((eds) => applyEdgeChanges(changes, eds))}
            onConnect={onConnect}
            onInit={(inst) => { reactFlowInstanceRef.current = inst; }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            isValidConnection={isValidConnection}
            fitView
            proOptions={{ hideAttribution: true }}
            connectionMode="loose"
            connectionLineComponent={SmoothStepEdge}
            defaultEdgeOptions={{
              type: 'floating',
              markerEnd: { type: 'arrowclosed', color: '#6a1b9a' },
              style: { stroke: '#6a1b9a', strokeWidth: 2 },
            }}
            panOnDrag={activeTool === 'pan'}
            selectionOnDrag={activeTool === 'select'}
          >
            <MiniMap
              style={{
                position: 'absolute',
                bottom: '60px',
                right: '15px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }}
              nodeColor="#888"
              maskColor="rgba(255, 255, 255, 0.7)"
            />
          </ReactFlow>
          <div className="canvas-instructions">
            To move canvas, hold mouse wheel or spacebar while dragging, or use the hand tool.
          </div>
          <button className="add-node-button" onClick={addDefaultNode}>+</button>
        </div>
      </div>
      <BottomToolbar 
        zoomIn={zoomIn} 
        zoomOut={zoomOut}
        fitView={fitView}
        zoomLevel={zoom}
      />
    </div>
  );
};

export default EditorPage;