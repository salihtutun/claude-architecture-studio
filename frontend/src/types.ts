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
  endpoints?: Array<{ method: string; path: string; description?: string }>;
  tables?: Array<{ name: string; columns: TableColumn[] }>;
  iconName?: string;
  themeColor?: string; // "blue", "green", "purple", "orange", "red", "indigo"
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
  label?: string;
  animated?: boolean;
  type?: string;
  style?: Record<string, string | number>;
  className?: string;
  data?: {
    speed?: 'none' | 'slow' | 'medium' | 'fast';
    color?: string; // "blue", "green", "purple", "orange", "red", "indigo", "default"
  };
}

export interface DiagramState {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  updatedAt: string;
}

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
