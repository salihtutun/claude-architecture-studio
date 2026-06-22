export interface Position {
  x: number;
  y: number;
}

export interface TableColumn {
  name: string;
  type: string;
  isPK?: boolean;
}

export interface NodeData {
  label: string;
  description?: string;
  // Type-specific properties
  endpoints?: Array<{ method: string; path: string; description?: string }>;
  tables?: Array<{ name: string; columns: TableColumn[] }>;
  iconName?: string;
  // Styling
  themeColor?: string; // e.g. "blue", "green", "purple", "orange", "red", "indigo"
}

export interface ReactFlowNode {
  id: string;
  type: string;
  position: Position;
  data: NodeData;
  style?: Record<string, string | number>;
  width?: number;
  height?: number;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  animated?: boolean;
  type?: string; // e.g. "smoothstep", "straight", "step", "bezier"
  style?: Record<string, string | number>;
  className?: string;
  data?: {
    speed?: 'none' | 'slow' | 'medium' | 'fast';
    color?: string; // "blue", "green", "purple", "orange", "red", "indigo", "default"
    protocol?: string;
    requestSchema?: string;
    responseSchema?: string;
  };
}

export interface DiagramState {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  updatedAt: string;
}

// WebSocket message protocols
export type ClientMessageType = 'user_update' | 'request_state';
export type ServerMessageType = 'sync_state' | 'mcp_connected';

export interface ClientMessage {
  type: ClientMessageType;
  payload?: Partial<DiagramState>;
}

export interface ServerMessage {
  type: ServerMessageType;
  payload: DiagramState & { hasMcpConnection?: boolean };
}
