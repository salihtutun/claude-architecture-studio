import React from "react";
import { Trash2, Plus, Info, X } from "lucide-react";
import { ReactFlowNode, NodeData } from "../types";

interface SidebarProps {
  selectedNode: ReactFlowNode | null;
  onUpdateNode: (id: string, updatedFields: Partial<NodeData> & { type?: string }) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
}

const COLOR_OPTIONS = ["blue", "green", "purple", "orange", "red", "indigo"];
const TYPE_OPTIONS = [
  { value: "client", label: "Client App" },
  { value: "server", label: "API Server" },
  { value: "database", label: "Database" },
  { value: "queue", label: "Queue / Broker" },
  { value: "storage", label: "File Storage" },
  { value: "auth", label: "Auth Service" },
  { value: "cloud", label: "Cloud Gateway" },
  { value: "external", label: "External API" }
];

export const Sidebar: React.FC<SidebarProps> = ({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  onClose
}) => {
  if (!selectedNode) {
    return (
      <div className="studio-sidebar">
        <div className="sidebar-empty-state">
          <Info size={40} />
          <h3 style={{ fontFamily: "'Outfit', sans-serif" }}>Claude Architecture Studio</h3>
          <p>
            Select any node on the canvas to customize its labels, descriptions, schema fields, endpoints, and themes.
          </p>
          <div style={{ marginTop: "20px", fontSize: "11px", color: "var(--text-muted)", textAlign: "left", width: "100%" }}>
            <strong style={{ color: "var(--text-secondary)" }}>Canvas Controls:</strong>
            <ul style={{ paddingLeft: "15px", marginTop: "5px", lineHeight: "1.6" }}>
              <li>Drag nodes to position</li>
              <li>Drag handles to connect</li>
              <li>Click edges to select & delete</li>
              <li>Double-click nodes for editing</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const { id, type } = selectedNode;
  const data = selectedNode.data;

  // Handle simple text inputs
  const handleTextChange = (field: "label" | "description", val: string) => {
    onUpdateNode(id, { [field]: val });
  };

  const handleTypeChange = (newType: string) => {
    onUpdateNode(id, { type: newType });
  };

  const handleColorSelect = (color: string) => {
    onUpdateNode(id, { themeColor: color });
  };

  // Endpoint Editors (Server nodes)
  const endpoints = data.endpoints || [];
  
  const handleAddEndpoint = () => {
    const newEndpoints = [...endpoints, { method: "GET", path: "/new-route", description: "" }];
    onUpdateNode(id, { endpoints: newEndpoints });
  };

  const handleUpdateEndpoint = (idx: number, field: "method" | "path" | "description", val: string) => {
    const newEndpoints = endpoints.map((ep, i) => {
      if (i === idx) {
        return { ...ep, [field]: val };
      }
      return ep;
    });
    onUpdateNode(id, { endpoints: newEndpoints });
  };

  const handleDeleteEndpoint = (idx: number) => {
    const newEndpoints = endpoints.filter((_, i) => i !== idx);
    onUpdateNode(id, { endpoints: newEndpoints });
  };

  // Table Schema Editors (Database nodes)
  const tables = data.tables || [];

  const handleAddTable = () => {
    const newTables = [...tables, { name: "new_table", columns: ["id (INT)", "name (VARCHAR)"] }];
    onUpdateNode(id, { tables: newTables });
  };

  const handleUpdateTable = (idx: number, field: "name" | "columnsString", val: string) => {
    const newTables = tables.map((t, i) => {
      if (i === idx) {
        if (field === "columnsString") {
          return { ...t, columns: val.split(",").map(c => c.trim()).filter(Boolean) };
        }
        return { ...t, [field]: val };
      }
      return t;
    });
    onUpdateNode(id, { tables: newTables });
  };

  const handleDeleteTable = (idx: number) => {
    const newTables = tables.filter((_, i) => i !== idx);
    onUpdateNode(id, { tables: newTables });
  };

  return (
    <div className="studio-sidebar">
      <div className="sidebar-header">
        <h3 className="sidebar-title">Edit Component</h3>
        <button className="icon-btn-delete" onClick={onClose} title="Close Sidebar">
          <X size={16} />
        </button>
      </div>

      <div className="sidebar-content">
        {/* Node Type */}
        <div className="sidebar-section">
          <label className="section-label">Component Type</label>
          <select
            className="input-select"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Node Label */}
        <div className="sidebar-section">
          <label className="section-label">Label</label>
          <input
            type="text"
            className="input-text"
            value={data.label}
            onChange={(e) => handleTextChange("label", e.target.value)}
            placeholder="Node Label"
          />
        </div>

        {/* Node Description */}
        <div className="sidebar-section">
          <label className="section-label">Description</label>
          <textarea
            className="input-textarea"
            value={data.description || ""}
            onChange={(e) => handleTextChange("description", e.target.value)}
            placeholder="Enter brief description..."
          />
        </div>

        {/* Node Theme Color */}
        <div className="sidebar-section">
          <label className="section-label">Theme Color</label>
          <div className="color-picker">
            {COLOR_OPTIONS.map((c) => (
              <div
                key={c}
                className={`color-tile ${c} ${data.themeColor === c ? "selected" : ""}`}
                onClick={() => handleColorSelect(c)}
              />
            ))}
          </div>
        </div>

        {/* Server Endpoints Editor */}
        {type === "server" && (
          <div className="sidebar-section">
            <label className="section-label">API Routes</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {endpoints.map((ep, idx) => (
                <div key={idx} className="sub-editor-item">
                  <select
                    className="input-select"
                    value={ep.method || "GET"}
                    onChange={(e) => handleUpdateEndpoint(idx, "method", e.target.value)}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                    <option value="WS">WS</option>
                  </select>
                  <input
                    type="text"
                    className="input-text"
                    value={ep.path}
                    onChange={(e) => handleUpdateEndpoint(idx, "path", e.target.value)}
                    placeholder="/route-path"
                  />
                  <button
                    className="icon-btn-delete"
                    onClick={() => handleDeleteEndpoint(idx)}
                    title="Remove route"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button className="sub-btn-add" onClick={handleAddEndpoint}>
                <Plus size={14} /> Add Route Endpoint
              </button>
            </div>
          </div>
        )}

        {/* Database Tables Schema Editor */}
        {type === "database" && (
          <div className="sidebar-section">
            <label className="section-label">Database Schema</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {tables.map((table, idx) => (
                <div key={idx} className="sub-editor-item" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="text"
                      className="input-text"
                      style={{ fontWeight: 600 }}
                      value={table.name}
                      onChange={(e) => handleUpdateTable(idx, "name", e.target.value)}
                      placeholder="Table Name"
                    />
                    <button
                      className="icon-btn-delete"
                      onClick={() => handleDeleteTable(idx)}
                      title="Remove table"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <input
                    type="text"
                    className="input-text"
                    value={table.columns.join(", ")}
                    onChange={(e) => handleUpdateTable(idx, "columnsString", e.target.value)}
                    placeholder="id (PK), name, email"
                  />
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", paddingLeft: "4px" }}>
                    Enter fields, separated by commas.
                  </span>
                </div>
              ))}
              <button className="sub-btn-add" onClick={handleAddTable}>
                <Plus size={14} /> Add Table Schema
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="btn-secondary" onClick={() => onDeleteNode(id)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <Trash2 size={16} /> Delete Component
          </div>
        </button>
      </div>
    </div>
  );
};
