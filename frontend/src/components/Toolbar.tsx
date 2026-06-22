import React, { useState } from "react";
import {
  Download,
  Share2,
  Trash2,
  LayoutGrid,
  Plus
} from "lucide-react";

interface ToolbarProps {
  isConnected: boolean;
  onAutoLayout: () => void;
  onExportPNG: () => void;
  onCopyMermaid: () => void;
  onClearDiagram: () => void;
  onAddNode: (type: string) => void;
}

const QUICK_NODE_TYPES = [
  { value: "client", label: "Client App" },
  { value: "server", label: "API Server" },
  { value: "database", label: "Database" },
  { value: "queue", label: "Queue / Broker" },
  { value: "storage", label: "File Storage" },
  { value: "auth", label: "Auth Service" },
  { value: "cloud", label: "Cloud Gateway" },
  { value: "external", label: "External API" }
];

export const Toolbar: React.FC<ToolbarProps> = ({
  isConnected,
  onAutoLayout,
  onExportPNG,
  onCopyMermaid,
  onClearDiagram,
  onAddNode
}) => {
  const [insertOpen, setInsertOpen] = useState(false);

  return (
    <div className="hud-toolbar">
      {/* Sync Connection Status */}
      <div className="connection-badge" title={isConnected ? "Synced with Claude (MCP)" : "Disconnected from MCP Server"}>
        <div className={`status-dot ${isConnected ? "connected" : "disconnected"}`} />
        <span>{isConnected ? "Live Sync" : "Offline"}</span>
      </div>

      <div className="toolbar-separator" />

      {/* Add node buttons */}
      <div style={{ position: "relative" }}>
        <button
          className={`toolbar-btn ${insertOpen ? "active" : ""}`}
          onClick={() => setInsertOpen(!insertOpen)}
          title="Add Component"
        >
          <Plus size={16} />
        </button>

        {insertOpen && (
          <div
            style={{
              position: "absolute",
              top: "45px",
              left: "0",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--glass-shadow)",
              borderRadius: "8px",
              padding: "6px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              width: "150px",
              zIndex: 50
            }}
          >
            {QUICK_NODE_TYPES.map((type) => (
              <button
                key={type.value}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-primary)",
                  textAlign: "left",
                  padding: "6px 10px",
                  fontSize: "12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  width: "100%"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => {
                  onAddNode(type.value);
                  setInsertOpen(false);
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar-separator" />

      {/* Control Actions */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onAutoLayout} title="Auto-align Layout">
          <LayoutGrid size={16} />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Export Options */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onExportPNG} title="Export to PNG Image">
          <Download size={16} />
        </button>
        <button className="toolbar-btn" onClick={onCopyMermaid} title="Export Mermaid, SQL, or TS Code">
          <Share2 size={16} />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Destructive actions */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => {
            if (window.confirm("Are you sure you want to clear the entire diagram?")) {
              onClearDiagram();
            }
          }}
          title="Clear Canvas"
          style={{ color: "var(--theme-red)" }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
