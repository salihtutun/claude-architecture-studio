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
  ExternalLink
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
                <div className="table-columns">
                  {table.columns.map((col, colIdx) => (
                    <span key={colIdx}>• {col}</span>
                  ))}
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
