import React, { useState, memo } from 'react';
import './Sidebar.css';
import { 
  FaTable, FaFileCsv, FaDatabase, FaFileExcel,
  FaFilter, FaChartLine, FaCogs, FaRandom,
  FaBrain, FaProjectDiagram, FaLayerGroup,
  FaChartBar, FaChartPie, FaNetworkWired,
  FaCog, FaTools
} from 'react-icons/fa';

// Hoist static node category configuration to avoid recreating on each render
const NODE_CATEGORIES = {
  'File Loading': {
    icon: FaFileCsv,
    nodes: [
      { type: 'csvReader', name: 'CSV Reader', icon: FaTable },
      { type: 'excelReader', name: 'Excel Reader', icon: FaFileExcel },
      { type: 'databaseReader', name: 'Database Reader', icon: FaDatabase },
    ],
  },
  'Data Preprocessing': {
    icon: FaFilter,
    nodes: [
      { type: 'dataCleaner', name: 'Data Cleaner', icon: FaCogs },
      { type: 'encoder', name: 'Encoder', icon: FaCogs },
      { type: 'normalizer', name: 'Normalizer', icon: FaChartLine },
      { type: 'scaler', name: 'Scaler', icon: FaRandom },
      { type: 'featureSelector', name: 'Feature Selector', icon: FaTools },
    ],
  },
  'Regression Models': {
    icon: FaChartLine,
    nodes: [
      { type: 'linearRegression', name: 'Linear Regression', icon: FaChartLine },
      { type: 'multiLinearRegression', name: 'Multi Linear Regression', icon: FaChartLine },
        { type: 'genericModel', name: 'Generic Model (Backend)', icon: FaCogs },
      { type: 'polynomialRegression', name: 'Polynomial Regression', icon: FaChartBar },
      { type: 'ridgeRegression', name: 'Ridge Regression', icon: FaChartLine },
      { type: 'lassoRegression', name: 'Lasso Regression', icon: FaChartLine },
    ],
  },
  'Clustering Models': {
    icon: FaChartPie,
    nodes: [
      { type: 'kMeans', name: 'K-Means', icon: FaChartPie },
      { type: 'hierarchicalClustering', name: 'Hierarchical Clustering', icon: FaLayerGroup },
      { type: 'dbscan', name: 'DBSCAN', icon: FaProjectDiagram },
    ],
  },
  'Neural Networks': {
    icon: FaBrain,
    nodes: [
      { type: 'mlp', name: 'Multi-Layer Perceptron', icon: FaBrain },
      { type: 'cnn', name: 'Convolutional Neural Network', icon: FaNetworkWired },
      { type: 'rnn', name: 'Recurrent Neural Network', icon: FaNetworkWired },
      { type: 'transformer', name: 'Transformer', icon: FaBrain },
    ],
  },
  'Visualization': {
    icon: FaChartBar,
    nodes: [
      { type: 'modelVisualizer', name: 'Model Visualizer', icon: FaChartLine },
      { type: 'dataVisualizer', name: 'Data Visualizer', icon: FaChartPie },
    ],
  },
  'Miscellaneous': {
    icon: FaCog,
    nodes: [
      { type: 'evaluator', name: 'Model Evaluator', icon: FaChartBar },
      { type: 'visualizer', name: 'Generic Visualizer', icon: FaChartPie },
      { type: 'exporter', name: 'Model Exporter', icon: FaTools },
    ],
  },
};

const Sidebar = ({ className = '' }) => {
  // Default open File Loading, Data Preprocessing, and Visualization per UI
  const [expandedCategories, setExpandedCategories] = useState({
    'File Loading': true,
    'Data Preprocessing': true,
    'Visualization': true,
  });

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const onDragStart = (event, nodeType, nodeName) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-name', nodeName);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className={`sidebar ${className}`}>
      <div className="sidebar-header">Node Library</div>
      <div className="sidebar-content">
        {Object.entries(NODE_CATEGORIES).map(([categoryName, categoryData]) => (
          <div key={categoryName} className="category-section">
            <div className="category-header" onClick={() => toggleCategory(categoryName)}>
              <categoryData.icon className="category-icon" />
              <span className="category-name">{categoryName}</span>
              <span className={`expand-icon ${expandedCategories[categoryName] ? 'expanded' : ''}`}>▼</span>
            </div>
            {expandedCategories[categoryName] && (
              <div className="category-nodes">
                {categoryData.nodes.map((node) => (
                  <div
                    key={node.type}
                    className="node-palette-item"
                    onDragStart={(event) => onDragStart(event, node.type, node.name)}
                    draggable
                  >
                    <node.icon className="palette-icon" />
                    <span>{node.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default memo(Sidebar);