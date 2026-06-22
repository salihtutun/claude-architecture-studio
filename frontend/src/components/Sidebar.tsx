import React from "react";
import { Trash2, Plus, Info, X, Key } from "lucide-react";
import { ReactFlowNode, NodeData, ReactFlowEdge } from "../types";

interface SidebarProps {
  selectedNode: ReactFlowNode | null;
  onUpdateNode: (id: string, updatedFields: Partial<NodeData> & { type?: string }) => void;
  onDeleteNode: (id: string) => void;
  selectedEdge?: ReactFlowEdge | null;
  onUpdateEdge?: (id: string, updatedFields: Partial<ReactFlowEdge['data']> & { label?: string, type?: string }) => void;
  onDeleteEdge?: (id: string) => void;
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
  selectedEdge,
  onUpdateEdge,
  onDeleteEdge,
  onClose
}) => {
  if (!selectedNode) {
    if (selectedEdge) {
      const { id, label, type: edgeType, data } = selectedEdge;
      const speed = data?.speed || "medium";
      const color = data?.color || "default";

      return (
        <div className="studio-sidebar">
          <div className="sidebar-header">
            <h3 className="sidebar-title">Edit Connection</h3>
            <button className="icon-btn-delete" onClick={onClose} title="Close Sidebar">
              <X size={16} />
            </button>
          </div>

          <div className="sidebar-content">
            {/* Connection Label */}
            <div className="sidebar-section">
              <label className="section-label">Label</label>
              <input
                type="text"
                className="input-text"
                value={label || ""}
                onChange={(e) => onUpdateEdge?.(id, { label: e.target.value })}
                placeholder="e.g. REST, gRPC, SQL"
              />
            </div>

            {/* Connection Style / Routing */}
            <div className="sidebar-section">
              <label className="section-label">Routing Style</label>
              <select
                className="input-select"
                value={edgeType || "smoothstep"}
                onChange={(e) => onUpdateEdge?.(id, { type: e.target.value })}
              >
                <option value="smoothstep">Smoothstep (Default)</option>
                <option value="straight">Straight</option>
                <option value="step">Step</option>
                <option value="bezier">Bezier Curve</option>
              </select>
            </div>

            {/* Connection Speed */}
            <div className="sidebar-section">
              <label className="section-label">Animation Speed</label>
              <select
                className="input-select"
                value={speed}
                onChange={(e) => onUpdateEdge?.(id, { speed: e.target.value as any })}
              >
                <option value="none">None (Static Line)</option>
                <option value="slow">Slow Pulse</option>
                <option value="medium">Medium Pulse</option>
                <option value="fast">Fast Pulse</option>
              </select>
            </div>

            {/* Connection Theme Color */}
            <div className="sidebar-section">
              <label className="section-label">Connection Color</label>
              <div className="color-picker">
                {["default", "blue", "green", "purple", "orange", "red", "indigo"].map((c) => (
                  <div
                    key={c}
                    className={`color-tile ${c === "default" ? "color-default-tile" : c} ${color === c ? "selected" : ""}`}
                    style={{
                      backgroundColor: c === "default" ? "#475569" : `var(--theme-${c})`,
                      border: color === c ? "2px solid #fff" : "2px solid transparent"
                    }}
                    onClick={() => onUpdateEdge?.(id, { color: c })}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Connection Protocol */}
            <div className="sidebar-section">
              <label className="section-label">Protocol / Method</label>
              <input
                type="text"
                className="input-text"
                value={data?.protocol || ""}
                onChange={(e) => onUpdateEdge?.(id, { protocol: e.target.value })}
                placeholder="e.g. HTTP GET, gRPC, Pub/Sub"
              />
            </div>

            {/* Request Schema */}
            <div className="sidebar-section">
              <label className="section-label">Request Payload (JSON)</label>
              <textarea
                className="input-textarea"
                style={{ fontFamily: "'Fira Code', monospace", fontSize: "11px", minHeight: "80px" }}
                value={data?.requestSchema || ""}
                onChange={(e) => onUpdateEdge?.(id, { requestSchema: e.target.value })}
                placeholder='e.g. { "id": "123" }'
              />
            </div>

            {/* Response Schema */}
            <div className="sidebar-section">
              <label className="section-label">Response Payload (JSON)</label>
              <textarea
                className="input-textarea"
                style={{ fontFamily: "'Fira Code', monospace", fontSize: "11px", minHeight: "80px" }}
                value={data?.responseSchema || ""}
                onChange={(e) => onUpdateEdge?.(id, { responseSchema: e.target.value })}
                placeholder='e.g. { "status": "success" }'
              />
            </div>
          </div>

          <div className="sidebar-footer">
            <button className="btn-secondary" onClick={() => onDeleteEdge?.(id)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <Trash2 size={16} /> Disconnect Paths
              </div>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="studio-sidebar">
        <div className="sidebar-empty-state">
          <Info size={40} />
          <h3 style={{ fontFamily: "'Outfit', sans-serif" }}>Claude Architecture Studio</h3>
          <p>
            Select any node or connection path on the canvas to customize labels, descriptions, schemas, routing, and speeds.
          </p>
          <div style={{ marginTop: "20px", fontSize: "11px", color: "var(--text-muted)", textAlign: "left", width: "100%" }}>
            <strong style={{ color: "var(--text-secondary)" }}>Canvas Controls:</strong>
            <ul style={{ paddingLeft: "15px", marginTop: "5px", lineHeight: "1.6" }}>
              <li>Drag nodes to position</li>
              <li>Drag handles to connect</li>
              <li>Click edges to select & style</li>
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
    const newTables = [...tables, { name: "new_table", columns: [{ name: "id", type: "UUID", isPK: true }] }];
    onUpdateNode(id, { tables: newTables });
  };

  const handleUpdateTable = (tableIdx: number, newName: string) => {
    const newTables = tables.map((t, i) => {
      if (i === tableIdx) {
        return { ...t, name: newName };
      }
      return t;
    });
    onUpdateNode(id, { tables: newTables });
  };

  const handleDeleteTable = (idx: number) => {
    const newTables = tables.filter((_, i) => i !== idx);
    onUpdateNode(id, { tables: newTables });
  };

  const handleAddColumn = (tableIdx: number) => {
    const newTables = tables.map((t, i) => {
      if (i === tableIdx) {
        const columns = t.columns || [];
        return {
          ...t,
          columns: [...columns, { name: "new_column", type: "VARCHAR", isPK: false }]
        };
      }
      return t;
    });
    onUpdateNode(id, { tables: newTables });
  };

  const handleUpdateColumn = (tableIdx: number, colIdx: number, field: "name" | "type" | "isPK", val: any) => {
    const newTables = tables.map((t, i) => {
      if (i === tableIdx) {
        const columns = t.columns.map((c, j) => {
          if (j === colIdx) {
            return { ...c, [field]: val };
          }
          return c;
        });
        return { ...t, columns };
      }
      return t;
    });
    onUpdateNode(id, { tables: newTables });
  };

  const handleDeleteColumn = (tableIdx: number, colIdx: number) => {
    const newTables = tables.map((t, i) => {
      if (i === tableIdx) {
        return { ...t, columns: t.columns.filter((_, j) => j !== colIdx) };
      }
      return t;
    });
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
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {tables.map((table, idx) => (
                <div key={idx} className="sub-editor-item" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px", background: "rgba(0,0,0,0.25)", padding: "10px", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="text"
                      className="input-text"
                      style={{ fontWeight: 600 }}
                      value={table.name}
                      onChange={(e) => handleUpdateTable(idx, e.target.value)}
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
                  
                  {/* Columns List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                    <label className="section-label" style={{ fontSize: "9px" }}>Columns</label>
                    {table.columns.map((col, colIdx) => (
                      <div key={colIdx} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <input
                          type="text"
                          className="input-text"
                          style={{ flex: 1, padding: "4px 6px", fontSize: "11px" }}
                          value={col.name}
                          onChange={(e) => handleUpdateColumn(idx, colIdx, "name", e.target.value)}
                          placeholder="name"
                        />
                        <input
                          type="text"
                          className="input-text"
                          style={{ width: "80px", padding: "4px 6px", fontSize: "11px" }}
                          value={col.type}
                          onChange={(e) => handleUpdateColumn(idx, colIdx, "type", e.target.value)}
                          placeholder="type"
                        />
                        <button
                          type="button"
                          className="icon-btn-delete"
                          style={{
                            padding: "6px",
                            background: col.isPK ? "rgba(245, 158, 11, 0.15)" : "transparent",
                            color: col.isPK ? "#f59e0b" : "var(--text-muted)",
                            border: col.isPK ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid transparent",
                            borderRadius: "4px"
                          }}
                          onClick={() => handleUpdateColumn(idx, colIdx, "isPK", !col.isPK)}
                          title={col.isPK ? "Primary Key" : "Toggle Primary Key"}
                        >
                          <Key size={12} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn-delete"
                          onClick={() => handleDeleteColumn(idx, colIdx)}
                          title="Delete column"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="sub-btn-add"
                      style={{ padding: "4px 8px", fontSize: "10px", marginTop: "4px" }}
                      onClick={() => handleAddColumn(idx)}
                    >
                      <Plus size={10} /> Add Column
                    </button>
                  </div>
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
