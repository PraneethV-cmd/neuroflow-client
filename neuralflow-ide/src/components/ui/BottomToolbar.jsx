import React, { memo } from 'react';
import './BottomToolbar.css';
import { MdAdd, MdRemove, MdZoomOutMap, MdUndo, MdRedo } from 'react-icons/md';

// The component now accepts props for zoom functionality
const BottomToolbar = ({ zoomIn, zoomOut, fitView, zoomLevel }) => {
  // Format the zoom level to a percentage
  const zoomPercentage = `${Math.round(zoomLevel * 100)}%`;

  return (
    <div className="bottom-toolbar">
      <div className="toolbar-left-bottom">
        {/* Attach the zoomOut function to the minus button's onClick handler */}
        <button className="icon-button" onClick={zoomOut}>
          <MdRemove />
        </button>

        <span className="zoom-level">{zoomPercentage}</span>

        {/* Attach the zoomIn function to the plus button's onClick handler */}
        <button className="icon-button" onClick={zoomIn}>
          <MdAdd />
        </button>
        
        {/* Attach the fitView function to a "fit view" button */}
        <button className="icon-button" onClick={fitView}>
          <MdZoomOutMap />
        </button>
      </div>
      <div className="toolbar-right-bottom">
        <button className="icon-button"><MdUndo /></button>
        <button className="icon-button"><MdRedo /></button>
      </div>
    </div>
  );
};

export default memo(BottomToolbar);