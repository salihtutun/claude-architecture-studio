import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import {
  Laptop,
  Server,
  Database,
  Layers,
  HardDrive,
  ShieldCheck,
  Cloud,
  ExternalLink,
  Key
} from "lucide-react";
import { NodeData } from "../types";

// Base Node Component Wrapper
interface BaseNodeProps {
  type: string;
  icon: React.ReactNode;
  themeColor?: string;
  selected?: boolean;
  label: string;
  description?: string;
  children?: React.ReactNode;
}

const BaseNode: React.FC<BaseNodeProps> = ({
  type,
  icon,
  themeColor = "blue",
  selected = false,
  label,
  description,
  children
}) => {
  return (
    <div className={`custom-node color-${themeColor} ${selected ? "selected" : ""}`}>
      {/* Target Handles (Inputs) */}
      <Handle type="target" position={Position.Left} id="left-in" />
      <Handle type="target" position={Position.Top} id="top-in" />
      
      {/* Source Handles (Outputs) */}
      <Handle type="source" position={Position.Right} id="right-out" />
      <Handle type="source" position={Position.Bottom} id="bottom-out" />

      {/* Header */}
      <div className="node-header">
        <div className="node-icon">{icon}</div>
        <div className="node-title-area">
          <div className="node-label">{label}</div>
          <div className="node-type-badge">{type}</div>
        </div>
      </div>

      {/* Body */}
      <div className="node-body">
        {description && <p className="node-description">{description}</p>}
        {children}
      </div>
    </div>
  );
};

// Specialized Nodes
export const ClientNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as NodeData;
  return (
    <BaseNode
      type="Client App"
      icon={<Laptop size={18} />}
      themeColor={nodeData.themeColor || "blue"}
      selected={selected}
      label={nodeData.label}
      description={nodeData.description}
    />
  );
});

export const ServerNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as NodeData;
  return (
    <BaseNode
      type="API Server"
      icon={<Server size={18} />}
      themeColor={nodeData.themeColor || "green"}
      selected={selected}
      label={nodeData.label}
      description={nodeData.description}
    >
      {nodeData.endpoints && nodeData.endpoints.length > 0 && (
        <>
          <div className="node-list-title">Endpoints</div>
          <div className="node-list-container">
            {nodeData.endpoints.map((ep, idx) => (
              <div key={idx} className="endpoint-row">
                <span className={`endpoint-method ${(ep.method || "GET").toLowerCase()}`}>
                  {ep.method || "GET"}
                </span>
                <span className="endpoint-path" title={ep.path}>
                  {ep.path}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </BaseNode>
  );
});

export const DatabaseNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as NodeData;
  return (
    <BaseNode
      type="Database"
      icon={<Database size={18} />}
      themeColor={nodeData.themeColor || "orange"}
      selected={selected}
      label={nodeData.label}
      description={nodeData.description}
    >
      {nodeData.tables && nodeData.tables.length > 0 && (
        <>
          <div className="node-list-title">Tables / Schema</div>
          <div className="node-list-container">
            {nodeData.tables.map((table, idx) => (
              <div key={idx} className="table-row">
                <div className="table-name">
                  <Database size={10} /> {table.name}
                </div>
                <div className="table-columns" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  {table.columns.map((col, colIdx) => {
                    const isColPK = !!col.isPK;
                    const colName = col.name;
                    const colType = col.type || "text";

                    return (
                      <div
                        key={colIdx}
                        className="db-column-row"
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          width: "100%",
                          lineHeight: "1.2",
                          padding: "2px 0"
                        }}
                      >
                        {/* Column Input Handle */}
                        <Handle
                          type="target"
                          position={Position.Left}
                          id={`col-${table.name}-${colName}-in`}
                          className="db-column-handle target"
                          style={{
                            left: "-20px",
                            background: "var(--theme-orange)",
                            borderColor: "var(--bg-secondary)",
                            width: "6px",
                            height: "6px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            zIndex: 10
                          }}
                        />

                        <span style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {isColPK && <Key size={9} style={{ color: "#f59e0b", flexShrink: 0 }} />}
                          <span style={{
                            fontWeight: isColPK ? 600 : 400,
                            color: isColPK ? "var(--text-primary)" : "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}>
                            {colName}
                          </span>
                        </span>
                        <span style={{
                          color: "var(--text-muted)",
                          fontSize: "8px",
                          fontStyle: "italic",
                          flexShrink: 0
                        }}>
                          {colType}
                        </span>

                        {/* Column Output Handle */}
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`col-${table.name}-${colName}-out`}
                          className="db-column-handle source"
                          style={{
                            right: "-20px",
                            background: "var(--theme-orange)",
                            borderColor: "var(--bg-secondary)",
                            width: "6px",
                            height: "6px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            zIndex: 10
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </BaseNode>
  );
});

export const QueueNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as NodeData;
  return (
    <BaseNode
      type="Queue / Broker"
      icon={<Layers size={18} />}
      themeColor={nodeData.themeColor || "purple"}
      selected={selected}
      label={nodeData.label}
      description={nodeData.description}
    />
  );
});

export const StorageNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as NodeData;
  return (
    <BaseNode
      type="File Storage"
      icon={<HardDrive size={18} />}
      themeColor={nodeData.themeColor || "indigo"}
      selected={selected}
      label={nodeData.label}
      description={nodeData.description}
    />
  );
});

export const AuthNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as NodeData;
  return (
    <BaseNode
      type="Auth Service"
      icon={<ShieldCheck size={18} />}
      themeColor={nodeData.themeColor || "red"}
      selected={selected}
      label={nodeData.label}
      description={nodeData.description}
    />
  );
});

export const CloudNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as NodeData;
  return (
    <BaseNode
      type="Cloud Gateway"
      icon={<Cloud size={18} />}
      themeColor={nodeData.themeColor || "purple"}
      selected={selected}
      label={nodeData.label}
      description={nodeData.description}
    />
  );
});

export const ExternalNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as NodeData;
  return (
    <BaseNode
      type="External API"
      icon={<ExternalLink size={18} />}
      themeColor={nodeData.themeColor || "blue"}
      selected={selected}
      label={nodeData.label}
      description={nodeData.description}
    />
  );
});

// Registry exports for React Flow
export const nodeTypes = {
  client: ClientNode,
  server: ServerNode,
  database: DatabaseNode,
  queue: QueueNode,
  storage: StorageNode,
  auth: AuthNode,
  cloud: CloudNode,
  external: ExternalNode
};
