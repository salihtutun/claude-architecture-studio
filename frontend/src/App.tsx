import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  Edge
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { X } from "lucide-react";

import { nodeTypes } from "./components/CustomNodes";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { ReactFlowNode, ReactFlowEdge, ClientMessage, ServerMessage, NodeData } from "./types";

const AppContent: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showMermaidModal, setShowMermaidModal] = useState(false);
  const [mermaidCode, setMermaidCode] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const isSyncingRef = useRef(false);

  // Normalize incoming db nodes for backwards-compatibility
  const normalizeDatabaseNodes = (incomingNodes: any[]): any[] => {
    if (!incomingNodes) return [];
    return incomingNodes.map((node) => {
      if (node.type === "database" && node.data?.tables) {
        const parsedTables = node.data.tables.map((table: any) => {
          const parsedColumns = (table.columns || []).map((col: any) => {
            if (col && typeof col === "object" && "name" in col) {
              return col;
            }
            if (typeof col === "string") {
              const trimmed = col.trim();
              const match = trimmed.match(/^([a-zA-Z0-9_]+)(?:\s*\(([^)]+)\))?$/i);
              if (match) {
                const name = match[1];
                const type = match[2] || "text";
                const isPK = name.toLowerCase() === "id";
                return { name, type, isPK };
              }
              return {
                name: trimmed,
                type: "text",
                isPK: trimmed.toLowerCase() === "id"
              };
            }
            return { name: "unknown", type: "text" };
          });
          return { ...table, columns: parsedColumns };
        });
        return {
          ...node,
          data: {
            ...node.data,
            tables: parsedTables
          }
        };
      }
      return node;
    });
  };

  // Sync edits back to MCP Server
  const syncWithServer = useCallback((updatedNodes: ReactFlowNode[], updatedEdges: ReactFlowEdge[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      isSyncingRef.current = true;
      const msg: ClientMessage = {
        type: "user_update",
        payload: {
          nodes: updatedNodes,
          edges: updatedEdges
        }
      };
      wsRef.current.send(JSON.stringify(msg));
      // Reset syncing flag shortly after
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 50);
    }
  }, []);

  // Set up WebSocket connection with retry
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Check if we are running in Vite dev mode (port 5173), fallback to port 9000
      const wsUrl = window.location.port === "5173"
        ? "ws://localhost:9000"
        : `${protocol}//${window.location.host}`;

      console.log(`Connecting to WebSocket at: ${wsUrl}`);
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected successfully.");
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          if (msg.type === "sync_state" && msg.payload) {
            // Only update locally if we did not trigger the sync
            if (!isSyncingRef.current) {
              setNodes(normalizeDatabaseNodes(msg.payload.nodes));
              setEdges(msg.payload.edges);
            }
          }
        } catch (err) {
          console.error("Error parsing WebSocket sync message:", err);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected. Retrying in 3 seconds...");
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        socket?.close();
      };
    };

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [setNodes, setEdges]);

  // Hook into node selection
  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: any, edge: any) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  // Coordinate additions / edits
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge-${params.source}-${params.target}`,
        animated: true,
        type: "smoothstep",
        className: "edge-color-default edge-speed-medium",
        data: {
          speed: "medium",
          color: "default"
        }
      };
      setEdges((eds) => {
        const nextEds = addEdge(newEdge, eds);
        // Queue state sync
        setTimeout(() => syncWithServer(nodes, nextEds), 0);
        return nextEds;
      });
    },
    [nodes, setEdges, syncWithServer]
  );

  // Sync node changes on drag stop
  const onNodeDragStop = useCallback(() => {
    syncWithServer(nodes, edges);
  }, [nodes, edges, syncWithServer]);

  // Sync edge additions / deletions
  useEffect(() => {
    // Only trigger if connection is established and it's not a server-driven sync
    if (nodes.length > 0 && isConnected && !isSyncingRef.current) {
      const timer = setTimeout(() => {
        syncWithServer(nodes, edges);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, isConnected, syncWithServer]);

  // Custom Local Node Creation
  const handleAddNode = useCallback((type: string) => {
    const id = `node-${type}-${Date.now().toString().slice(-4)}`;
    
    // Choose coordinate space around center viewport
    const x = 200 + Math.random() * 200;
    const y = 150 + Math.random() * 200;

    const labelMap: Record<string, string> = {
      client: "New Web App",
      server: "Express Server",
      database: "Postgres Database",
      queue: "Kafka Queue",
      storage: "S3 Bucket",
      auth: "Auth0 Service",
      cloud: "Cloud CDN",
      external: "Stripe API"
    };

    const colorMap: Record<string, string> = {
      client: "blue",
      server: "green",
      database: "orange",
      queue: "purple",
      storage: "indigo",
      auth: "red",
      cloud: "purple",
      external: "blue"
    };

    const newNode: ReactFlowNode = {
      id,
      type,
      position: { x, y },
      data: {
        label: labelMap[type] || "New Node",
        description: `Custom ${type} component description`,
        themeColor: colorMap[type] || "blue",
        endpoints: type === "server" ? [{ method: "GET", path: "/health", description: "Health check" }] : undefined,
        tables: type === "database" ? [{ name: "users", columns: [{ name: "id", type: "UUID", isPK: true }, { name: "username", type: "VARCHAR" }] }] : undefined
      }
    };

    setNodes((nds) => {
      const nextNds = [...nds, newNode];
      setTimeout(() => syncWithServer(nextNds, edges), 0);
      return nextNds;
    });
    setSelectedNodeId(id);
  }, [edges, setNodes, syncWithServer]);

  // Sidebar updates: modify properties of specific node
  const handleUpdateNode = useCallback((id: string, updatedFields: Partial<NodeData> & { type?: string }) => {
    setNodes((nds) => {
      const nextNds = nds.map((node) => {
        if (node.id === id) {
          const { type, ...rest } = updatedFields;
          const nextNode = { ...node };
          if (type) nextNode.type = type;
          nextNode.data = { ...node.data, ...rest };
          return nextNode;
        }
        return node;
      });
      setTimeout(() => syncWithServer(nextNds, edges), 0);
      return nextNds;
    });
  }, [edges, setNodes, syncWithServer]);

  // Sidebar updates: delete specific node
  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => {
      const nextNds = nds.filter((n) => n.id !== id);
      setEdges((eds) => {
        const nextEds = eds.filter((e) => e.source !== id && e.target !== id);
        setTimeout(() => syncWithServer(nextNds, nextEds), 0);
        return nextEds;
      });
      return nextNds;
    });
    setSelectedNodeId(null);
  }, [setNodes, setEdges, syncWithServer]);

  // Sidebar updates: modify properties of specific edge
  const handleUpdateEdge = useCallback((id: string, updatedFields: Partial<ReactFlowEdge['data']> & { label?: string, type?: string }) => {
    setEdges((eds) => {
      const nextEds = eds.map((edge) => {
        if (edge.id === id) {
          const { label, type, ...dataFields } = updatedFields;
          const nextEdge = { ...edge };
          if (label !== undefined) nextEdge.label = label;
          if (type !== undefined) nextEdge.type = type;

          const currentData = edge.data || {};
          const speed = dataFields.speed !== undefined ? dataFields.speed : (currentData.speed || "medium");
          const color = dataFields.color !== undefined ? dataFields.color : (currentData.color || "default");

          nextEdge.className = `edge-color-${color} edge-speed-${speed}`;
          nextEdge.data = { ...currentData, ...dataFields, speed, color };
          nextEdge.animated = speed !== "none";

          return nextEdge;
        }
        return edge;
      });
      setTimeout(() => syncWithServer(nodes, nextEds), 0);
      return nextEds;
    });
  }, [nodes, setEdges, syncWithServer]);

  // Sidebar updates: delete specific edge
  const handleDeleteEdge = useCallback((id: string) => {
    setEdges((eds) => {
      const nextEds = eds.filter((e) => e.id !== id);
      setTimeout(() => syncWithServer(nodes, nextEds), 0);
      return nextEds;
    });
    setSelectedEdgeId(null);
  }, [nodes, setEdges, syncWithServer]);

  // Toolbar Actions: Auto Layout
  const handleAutoLayout = useCallback(() => {
    const colMappings: Record<string, number> = {
      client: 0,
      cloud: 1,
      auth: 1,
      server: 2,
      queue: 2,
      storage: 3,
      database: 3,
      external: 3
    };

    // Calculate node coordinates in columns
    const columns: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [] };
    
    nodes.forEach((n) => {
      const colIdx = colMappings[n.type] !== undefined ? colMappings[n.type] : 1;
      columns[colIdx].push(n.id);
    });

    setNodes((nds) => {
      const nextNds = nds.map((node) => {
        const colIdx = colMappings[node.type] !== undefined ? colMappings[node.type] : 1;
        const colNodeIds = columns[colIdx];
        const indexInCol = colNodeIds.indexOf(node.id);

        const colWidth = 280;
        const rowHeight = 220;
        const startX = 80;
        const startY = 160;

        return {
          ...node,
          position: {
            x: startX + colIdx * colWidth,
            y: startY + indexInCol * rowHeight
          }
        };
      });
      setTimeout(() => syncWithServer(nextNds, edges), 0);
      return nextNds;
    });
  }, [nodes, edges, setNodes, syncWithServer]);

  // Toolbar Actions: Clear All
  const handleClearDiagram = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    syncWithServer([], []);
  }, [setNodes, setEdges, syncWithServer]);

  // Toolbar Actions: Export PNG
  const handleExportPNG = useCallback(() => {
    const element = document.querySelector(".react-flow") as HTMLElement;
    if (!element) return;

    toPng(element, {
      backgroundColor: "#090d16",
      width: element.offsetWidth,
      height: element.offsetHeight,
      style: {
        transform: "none"
      }
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `system-design-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();

        // Trigger confetti!
        import("canvas-confetti").then((module) => {
          module.default({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.8 }
          });
        });
      })
      .catch((err) => {
        console.error("Failed to export image:", err);
      });
  }, []);

  // Toolbar Actions: Share/Copy Mermaid Diagram
  const handleCopyMermaid = useCallback(() => {
    let code = "graph LR\n";
    
    // Global Styling Definitions in Mermaid
    code += "  %% Custom node styles\n";
    code += "  classDef client fill:#0c4a6e,stroke:#38bdf8,stroke-width:2px,color:#fff;\n";
    code += "  classDef server fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff;\n";
    code += "  classDef database fill:#7c2d12,stroke:#fb923c,stroke-width:2px,color:#fff;\n";
    code += "  classDef queue fill:#581c87,stroke:#c084fc,stroke-width:2px,color:#fff;\n";
    code += "  classDef storage fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#fff;\n";
    code += "  classDef auth fill:#7f1d1d,stroke:#f87171,stroke-width:2px,color:#fff;\n";
    code += "  classDef cloud fill:#4c1d95,stroke:#c084fc,stroke-width:2px,color:#fff;\n";
    code += "  classDef external fill:#1e3a8a,stroke:#3b82f6,stroke-width:2px,color:#fff;\n";
    code += "\n";

    nodes.forEach((n) => {
      const labelText = n.data.label;
      const descText = n.data.description ? ` - ${n.data.description}` : "";
      code += `  ${n.id}["${labelText}${descText}"]\n`;
      code += `  class ${n.id} ${n.type};\n`;
    });

    code += "\n";

    edges.forEach((e) => {
      const edgeLabel = e.label ? ` -->|"${e.label}"| ` : " --> ";
      code += `  ${e.source}${edgeLabel}${e.target}\n`;
    });

    setMermaidCode(code);
    setShowMermaidModal(true);
  }, [nodes, edges]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mermaidCode);
    alert("Mermaid code copied to clipboard!");
    setShowMermaidModal(false);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;

  return (
    <div className="studio-layout">
      {/* Interactive Graph Canvas */}
      <div className="flow-container">
        <Toolbar
          isConnected={isConnected}
          onAutoLayout={handleAutoLayout}
          onExportPNG={handleExportPNG}
          onCopyMermaid={handleCopyMermaid}
          onClearDiagram={handleClearDiagram}
          onAddNode={handleAddNode}
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          deleteKeyCode={["Backend", "Delete"]}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
          <Controls showInteractive={false} style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "#fff" }} />
        </ReactFlow>
      </div>

      {/* Side Editor Drawer */}
      <Sidebar
        selectedNode={selectedNode}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        selectedEdge={selectedEdge}
        onUpdateEdge={handleUpdateEdge}
        onDeleteEdge={handleDeleteEdge}
        onClose={onPaneClick}
      />

      {/* Mermaid Markdown modal popup */}
      {showMermaidModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <div className="modal-header">
              <span className="modal-title">Export Mermaid Diagram</span>
              <button
                className="icon-btn-delete"
                onClick={() => setShowMermaidModal(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                Copy this Mermaid code to paste into any GitHub markdown file or documentation wiki.
              </p>
              <textarea
                className="modal-textarea"
                readOnly
                value={mermaidCode}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" style={{ width: "auto" }} onClick={() => setShowMermaidModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" style={{ width: "auto", padding: "8px 16px" }} onClick={copyToClipboard}>
                Copy Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  );
};
