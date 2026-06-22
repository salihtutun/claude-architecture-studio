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
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTab, setExportTab] = useState<'mermaid' | 'sql' | 'typescript' | 'docker' | 'terraform'>('mermaid');
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

  // Helper to generate PostgreSQL DDL
  const generateSQLDDL = useCallback((): string => {
    let ddl = `-- PostgreSQL Database DDL Schema Export\n`;
    ddl += `-- Generated by Claude Architecture Studio at ${new Date().toISOString()}\n\n`;

    const dbNodes = nodes.filter((n: any) => n.type === "database");
    if (dbNodes.length === 0) {
      ddl += `-- No Database nodes found on the canvas.\n`;
      return ddl;
    }

    dbNodes.forEach((node: any) => {
      ddl += `-- ==================================================\n`;
      ddl += `-- Database: ${node.data.label}\n`;
      ddl += `-- ==================================================\n\n`;

      const tables = node.data.tables || [];
      tables.forEach((table: any) => {
        ddl += `CREATE TABLE ${table.name} (\n`;
        const colDefinitions = (table.columns || []).map((col: any) => {
          let line = `  ${col.name} ${col.type || "VARCHAR(255)"}`;
          if (col.isPK) {
            line += ` PRIMARY KEY`;
          }
          return line;
        });

        // Add foreign key relationships from edges if they connect this table!
        const tableFks: string[] = [];
        edges.forEach((edge: any) => {
          if (edge.target === node.id && edge.targetHandle && edge.sourceHandle) {
            const targetMatch = edge.targetHandle.match(/^col-([^-]+)-([^-]+)-in$/);
            const sourceMatch = edge.sourceHandle.match(/^col-([^-]+)-([^-]+)-out$/);
            
            if (targetMatch && sourceMatch) {
              const targetTable = targetMatch[1];
              const targetCol = targetMatch[2];
              const sourceTable = sourceMatch[1];
              const sourceCol = sourceMatch[2];
              
              if (targetTable === table.name) {
                const sourceNode = nodes.find((n: any) => n.id === edge.source);
                if (sourceNode && sourceNode.type === "database") {
                  tableFks.push(`  FOREIGN KEY (${targetCol}) REFERENCES ${sourceTable}(${sourceCol})`);
                }
              }
            }
          }
        });

        const allLines = [...colDefinitions, ...tableFks];
        ddl += allLines.join(",\n");
        ddl += `\n);\n\n`;
      });
    });

    return ddl;
  }, [nodes, edges]);

  // Helper to generate TypeScript interfaces & types
  const generateTypeScriptTypes = useCallback((): string => {
    let ts = `/**\n * TypeScript Interfaces & Types\n * Generated by Claude Architecture Studio\n */\n\n`;

    const dbNodes = nodes.filter((n: any) => n.type === "database");
    if (dbNodes.length > 0) {
      ts += `// ==========================================\n`;
      ts += `// DATABASE MODELS\n`;
      ts += `// ==========================================\n\n`;
      
      dbNodes.forEach((node: any) => {
        const tables = node.data.tables || [];
        tables.forEach((table: any) => {
          const interfaceName = table.name.charAt(0).toUpperCase() + table.name.slice(1).replace(/_([a-z])/g, (g: any) => g[1].toUpperCase());
          ts += `export interface ${interfaceName} {\n`;
          table.columns.forEach((col: any) => {
            let tsType = "string";
            const lowerType = (col.type || "").toLowerCase();
            if (lowerType.includes("int") || lowerType.includes("decimal") || lowerType.includes("numeric") || lowerType.includes("float") || lowerType.includes("double")) {
              tsType = "number";
            } else if (lowerType.includes("bool")) {
              tsType = "boolean";
            } else if (lowerType.includes("timestamp") || lowerType.includes("date")) {
              tsType = "Date";
            }
            ts += `  ${col.name}: ${tsType};\n`;
          });
          ts += `}\n\n`;
        });
      });
    }

    const serverNodes = nodes.filter((n: any) => n.type === "server");
    if (serverNodes.length > 0) {
      ts += `// ==========================================\n`;
      ts += `// API SERVICE PATHS & PAYLOADS\n`;
      ts += `// ==========================================\n\n`;

      serverNodes.forEach((node: any) => {
        const endpoints = node.data.endpoints || [];
        endpoints.forEach((ep: any) => {
          const cleanPath = ep.path.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "");
          const methodPrefix = ep.method.charAt(0).toUpperCase() + ep.method.slice(1).toLowerCase();
          
          ts += `// Path: ${ep.method} ${ep.path}\n`;
          if (ep.description) {
            ts += `// Description: ${ep.description}\n`;
          }
          
          let reqPayload = "any";
          const incomingEdge = edges.find((e: any) => e.target === node.id && e.data?.requestSchema);
          if (incomingEdge && incomingEdge.data?.requestSchema) {
            try {
              reqPayload = incomingEdge.data.requestSchema.trim();
            } catch (e) {}
          }
          ts += `export type ${methodPrefix}_${cleanPath}_Request = ${reqPayload};\n`;

          let resPayload = "any";
          const outgoingEdge = edges.find((e: any) => e.source === node.id && e.data?.responseSchema);
          if (outgoingEdge && outgoingEdge.data?.responseSchema) {
            try {
              resPayload = outgoingEdge.data.responseSchema.trim();
            } catch (e) {}
          }
          ts += `export type ${methodPrefix}_${cleanPath}_Response = ${resPayload};\n\n`;
        });
      });
    }

    return ts;
  }, [nodes, edges]);

  // Helper to generate Docker Compose
  const generateDockerCompose = useCallback((): string => {
    let yaml = `# Docker Compose Environment Configuration\n`;
    yaml += `# Generated by Claude Architecture Studio at ${new Date().toISOString()}\n\n`;
    yaml += `version: '3.8'\n\nservices:\n`;

    const servers = nodes.filter((n: any) => n.type === "server");
    const databases = nodes.filter((n: any) => n.type === "database");
    const queues = nodes.filter((n: any) => n.type === "queue");
    const storages = nodes.filter((n: any) => n.type === "storage");

    if (nodes.length === 0) {
      yaml += `  # No services defined on canvas.\n`;
      return yaml;
    }

    const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/^-+|-+$/g, "");

    // 1. Generate databases
    databases.forEach((node: any) => {
      const sName = cleanName(node.id);
      const lowerLabel = node.data.label.toLowerCase();
      
      if (lowerLabel.includes("postgres") || lowerLabel.includes("pg")) {
        yaml += `  ${sName}:\n`;
        yaml += `    image: postgres:15-alpine\n`;
        yaml += `    container_name: ${sName}\n`;
        yaml += `    ports:\n`;
        yaml += `      - "5432:5432"\n`;
        yaml += `    environment:\n`;
        yaml += `      POSTGRES_USER: postgres\n`;
        yaml += `      POSTGRES_PASSWORD: postgres\n`;
        yaml += `      POSTGRES_DB: ${node.data.tables?.[0]?.name || "app_db"}\n`;
        yaml += `    volumes:\n`;
        yaml += `      - ${sName}-data:/var/lib/postgresql/data\n\n`;
      } else if (lowerLabel.includes("redis") || lowerLabel.includes("cache")) {
        yaml += `  ${sName}:\n`;
        yaml += `    image: redis:7-alpine\n`;
        yaml += `    container_name: ${sName}\n`;
        yaml += `    ports:\n`;
        yaml += `      - "6379:6379"\n\n`;
      } else if (lowerLabel.includes("mongo")) {
        yaml += `  ${sName}:\n`;
        yaml += `    image: mongo:6\n`;
        yaml += `    container_name: ${sName}\n`;
        yaml += `    ports:\n`;
        yaml += `      - "27017:27017"\n`;
        yaml += `    environment:\n`;
        yaml += `      MONGO_INITDB_DATABASE: admin\n\n`;
      } else {
        yaml += `  ${sName}:\n`;
        yaml += `    image: mysql:8\n`;
        yaml += `    container_name: ${sName}\n`;
        yaml += `    ports:\n`;
        yaml += `      - "3306:3306"\n`;
        yaml += `    environment:\n`;
        yaml += `      MYSQL_ROOT_PASSWORD: root\n`;
        yaml += `      MYSQL_DATABASE: db\n\n`;
      }
    });

    // 2. Generate queues
    queues.forEach((node: any) => {
      const sName = cleanName(node.id);
      const lowerLabel = node.data.label.toLowerCase();
      if (lowerLabel.includes("rabbit")) {
        yaml += `  ${sName}:\n`;
        yaml += `    image: rabbitmq:3-management-alpine\n`;
        yaml += `    container_name: ${sName}\n`;
        yaml += `    ports:\n`;
        yaml += `      - "5672:5672"\n`;
        yaml += `      - "15672:15672"\n\n`;
      } else if (lowerLabel.includes("kafka")) {
        yaml += `  ${sName}-zookeeper:\n`;
        yaml += `    image: confluentinc/cp-zookeeper:7.3.0\n`;
        yaml += `    environment:\n`;
        yaml += `      ZOOKEEPER_CLIENT_PORT: 2181\n\n`;
        yaml += `  ${sName}:\n`;
        yaml += `    image: confluentinc/cp-kafka:7.3.0\n`;
        yaml += `    container_name: ${sName}\n`;
        yaml += `    ports:\n`;
        yaml += `      - "9092:9092"\n`;
        yaml += `    depends_on:\n`;
        yaml += `      - ${sName}-zookeeper\n`;
        yaml += `    environment:\n`;
        yaml += `      KAFKA_ZOOKEEPER_CONNECT: ${sName}-zookeeper:2181\n`;
        yaml += `      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://${sName}:9092\n\n`;
      }
    });

    // 3. Generate storage
    storages.forEach((node: any) => {
      const sName = cleanName(node.id);
      const lowerLabel = node.data.label.toLowerCase();
      if (lowerLabel.includes("s3") || lowerLabel.includes("minio") || lowerLabel.includes("cloud")) {
        yaml += `  ${sName}:\n`;
        yaml += `    image: minio/minio\n`;
        yaml += `    container_name: ${sName}\n`;
        yaml += `    ports:\n`;
        yaml += `      - "9000:9000"\n`;
        yaml += `      - "9001:9001"\n`;
        yaml += `    command: server /data --console-address ":9001"\n`;
        yaml += `    environment:\n`;
        yaml += `      MINIO_ROOT_USER: minioadmin\n`;
        yaml += `      MINIO_ROOT_PASSWORD: minioadmin\n\n`;
      }
    });

    // 4. Generate servers
    servers.forEach((node: any) => {
      const sName = cleanName(node.id);
      yaml += `  ${sName}:\n`;
      yaml += `    build:\n`;
      yaml += `      context: ./${sName}\n`;
      yaml += `      dockerfile: Dockerfile\n`;
      yaml += `    container_name: ${sName}\n`;
      yaml += `    ports:\n`;
      yaml += `      - "8080:8080"\n`;

      const dependencies: string[] = [];
      edges.forEach((edge: any) => {
        if (edge.source === node.id) {
          const targetNode = nodes.find((n: any) => n.id === edge.target);
          if (targetNode && (targetNode.type === "database" || targetNode.type === "queue" || targetNode.type === "storage")) {
            dependencies.push(cleanName(targetNode.id));
          }
        }
      });

      if (dependencies.length > 0) {
        yaml += `    depends_on:\n`;
        dependencies.forEach((dep) => {
          yaml += `      - ${dep}\n`;
        });
        yaml += `    environment:\n`;
        dependencies.forEach((dep) => {
          const upperDep = dep.toUpperCase().replace(/-/g, "_");
          yaml += `      - ${upperDep}_HOST=${dep}\n`;
        });
      }
      yaml += `\n`;
    });

    const dbVolumes = databases.filter((n: any) => n.data.label.toLowerCase().includes("postgres") || n.data.label.toLowerCase().includes("pg"));
    if (dbVolumes.length > 0) {
      yaml += `volumes:\n`;
      dbVolumes.forEach((node: any) => {
        yaml += `  ${cleanName(node.id)}-data:\n`;
      });
    }

    return yaml;
  }, [nodes, edges]);

  // Helper to generate Terraform AWS configuration
  const generateTerraformIaC = useCallback((): string => {
    let tf = `# Terraform AWS Cloud Architecture Configuration\n`;
    tf += `# Generated by Claude Architecture Studio at ${new Date().toISOString()}\n\n`;
    tf += `provider "aws" {\n  region = "us-east-1"\n}\n\n`;

    const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/^-+|-+$/g, "");

    // 1. Generate storage buckets
    nodes.filter((n: any) => n.type === "storage").forEach((node: any) => {
      const resName = cleanName(node.id);
      tf += `# AWS S3 Storage Bucket for: ${node.data.label}\n`;
      tf += `resource "aws_s3_bucket" "${resName}" {\n`;
      tf += `  bucket = "cas-s3-${resName.replace(/_/g, "-")}"\n`;
      tf += `  tags = {\n`;
      tf += `    Environment = "production"\n`;
      tf += `    App         = "cas-generated"\n`;
      tf += `  }\n`;
      tf += `}\n\n`;
    });

    // 2. Generate databases
    nodes.filter((n: any) => n.type === "database").forEach((node: any) => {
      const resName = cleanName(node.id);
      const lowerLabel = node.data.label.toLowerCase();
      
      if (lowerLabel.includes("postgres") || lowerLabel.includes("mysql") || lowerLabel.includes("db")) {
        const dbEngine = lowerLabel.includes("postgres") ? "postgres" : "mysql";
        const dbPort = dbEngine === "postgres" ? 5432 : 3306;

        tf += `# RDS DB instance representing Database card: ${node.data.label}\n`;
        tf += `resource "aws_db_instance" "${resName}" {\n`;
        tf += `  allocated_storage    = 20\n`;
        tf += `  engine               = "${dbEngine}"\n`;
        tf += `  instance_class       = "db.t3.micro"\n`;
        tf += `  db_name              = "${node.data.tables?.[0]?.name || "appdb"}"\n`;
        tf += `  username             = "admin"\n`;
        tf += `  password             = "PasswordSecure123!"\n`;
        tf += `  port                 = ${dbPort}\n`;
        tf += `  skip_final_snapshot  = true\n`;
        tf += `}\n\n`;
      } else if (lowerLabel.includes("redis") || lowerLabel.includes("cache")) {
        tf += `# Elasticache Redis cache representing: ${node.data.label}\n`;
        tf += `resource "aws_elasticache_cluster" "${resName}" {\n`;
        tf += `  cluster_id           = "cas-redis-${resName.replace(/_/g, "-")}"\n`;
        tf += `  engine               = "redis"\n`;
        tf += `  node_type            = "cache.t3.micro"\n`;
        tf += `  num_cache_nodes      = 1\n`;
        tf += `  parameter_group_name = "default.redis7"\n`;
        tf += `  port                 = 6379\n`;
        tf += `}\n\n`;
      }
    });

    // 3. Generate ECS containers representing server cards
    nodes.filter((n: any) => n.type === "server").forEach((node: any) => {
      const resName = cleanName(node.id);
      tf += `# Compute ECS Task and Service representing: ${node.data.label}\n`;
      tf += `resource "aws_ecs_task_definition" "${resName}" {\n`;
      tf += `  family                   = "${resName}-task"\n`;
      tf += `  requires_compatibilities = ["FARGATE"]\n`;
      tf += `  network_mode             = "awsvpc"\n`;
      tf += `  cpu                      = "256"\n`;
      tf += `  memory                   = "512"\n`;
      tf += `  container_definitions    = jsonencode([\n`;
      tf += `    {\n`;
      tf += `      name      = "${resName}"\n`;
      tf += `      image     = "123456789012.dkr.ecr.us-east-1.amazonaws.com/${resName}:latest"\n`;
      tf += `      essential = true\n`;
      tf += `      portMappings = [\n`;
      tf += `        {\n`;
      tf += `          containerPort = 8080\n`;
      tf += `          hostPort      = 8080\n`;
      tf += `        }\n`;
      tf += `      ]\n`;
      tf += `    }\n`;
      tf += `  ])\n`;
      tf += `}\n\n`;
    });

    // 4. Generate load balancers representing Cloud Gateways
    nodes.filter((n: any) => n.type === "cloud").forEach((node: any) => {
      const resName = cleanName(node.id);
      tf += `# Application Load Balancer representing Ingress: ${node.data.label}\n`;
      tf += `resource "aws_lb" "${resName}" {\n`;
      tf += `  name               = "cas-alb-${resName.replace(/_/g, "-")}"\n`;
      tf += `  internal           = false\n`;
      tf += `  load_balancer_type = "application"\n`;
      tf += `  subnets            = ["subnet-12345678", "subnet-87654321"]\n`;
      tf += `}\n\n`;
    });

    return tf;
  }, [nodes]);

  // Toolbar Actions: Share/Copy Specs (Unified)
  const handleCopyMermaid = useCallback(() => {
    let code = "graph LR\n";
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
      let edgeLabel = e.label ? ` -->|"${e.label}"| ` : " --> ";
      if (e.sourceHandle || e.targetHandle) {
        const srcCol = e.sourceHandle ? e.sourceHandle.replace("col-", "").replace("-out", "") : "";
        const dstCol = e.targetHandle ? e.targetHandle.replace("col-", "").replace("-in", "") : "";
        const colDetails = `${srcCol} ➜ ${dstCol}`;
        edgeLabel = ` -->|"${e.label ? `${e.label} (${colDetails})` : colDetails}"| `;
      }
      code += `  ${e.source}${edgeLabel}${e.target}\n`;
    });

    setMermaidCode(code);
    setShowExportModal(true);
    setExportTab('mermaid');
  }, [nodes, edges]);

  const getCodeForTab = () => {
    if (exportTab === "mermaid") return mermaidCode;
    if (exportTab === "sql") return generateSQLDDL();
    if (exportTab === "typescript") return generateTypeScriptTypes();
    if (exportTab === "docker") return generateDockerCompose();
    if (exportTab === "terraform") return generateTerraformIaC();
    return "";
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getCodeForTab());
    alert("Export copied to clipboard!");
    setShowExportModal(false);
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

      {/* Code & Specs Exporter Modal */}
      {showExportModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal" style={{ width: "600px", maxWidth: "95%" }}>
            <div className="modal-header">
              <span className="modal-title">Export Architecture Specs</span>
              <button
                className="icon-btn-delete"
                onClick={() => setShowExportModal(false)}
              >
                <X size={14} />
              </button>
            </div>
            
            {/* Modal Navigation Tabs */}
            <div className="export-tabs" style={{ display: "flex", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.15)", flexWrap: "wrap" }}>
              <button
                style={{
                  flex: 1,
                  minWidth: "100px",
                  padding: "10px 6px",
                  background: exportTab === "mermaid" ? "rgba(255,255,255,0.05)" : "transparent",
                  color: exportTab === "mermaid" ? "var(--theme-blue)" : "var(--text-secondary)",
                  border: "none",
                  borderBottom: exportTab === "mermaid" ? "2px solid var(--theme-blue)" : "2px solid transparent",
                  fontWeight: 600,
                  fontSize: "11px",
                  cursor: "pointer"
                }}
                onClick={() => setExportTab("mermaid")}
              >
                Mermaid
              </button>
              <button
                style={{
                  flex: 1,
                  minWidth: "100px",
                  padding: "10px 6px",
                  background: exportTab === "sql" ? "rgba(255,255,255,0.05)" : "transparent",
                  color: exportTab === "sql" ? "var(--theme-orange)" : "var(--text-secondary)",
                  border: "none",
                  borderBottom: exportTab === "sql" ? "2px solid var(--theme-orange)" : "2px solid transparent",
                  fontWeight: 600,
                  fontSize: "11px",
                  cursor: "pointer"
                }}
                onClick={() => setExportTab("sql")}
              >
                SQL DDL
              </button>
              <button
                style={{
                  flex: 1,
                  minWidth: "100px",
                  padding: "10px 6px",
                  background: exportTab === "typescript" ? "rgba(255,255,255,0.05)" : "transparent",
                  color: exportTab === "typescript" ? "var(--theme-green)" : "var(--text-secondary)",
                  border: "none",
                  borderBottom: exportTab === "typescript" ? "2px solid var(--theme-green)" : "2px solid transparent",
                  fontWeight: 600,
                  fontSize: "11px",
                  cursor: "pointer"
                }}
                onClick={() => setExportTab("typescript")}
              >
                TS Types
              </button>
              <button
                style={{
                  flex: 1,
                  minWidth: "100px",
                  padding: "10px 6px",
                  background: exportTab === "docker" ? "rgba(255,255,255,0.05)" : "transparent",
                  color: exportTab === "docker" ? "var(--theme-indigo)" : "var(--text-secondary)",
                  border: "none",
                  borderBottom: exportTab === "docker" ? "2px solid var(--theme-indigo)" : "2px solid transparent",
                  fontWeight: 600,
                  fontSize: "11px",
                  cursor: "pointer"
                }}
                onClick={() => setExportTab("docker")}
              >
                Docker Compose
              </button>
              <button
                style={{
                  flex: 1,
                  minWidth: "100px",
                  padding: "10px 6px",
                  background: exportTab === "terraform" ? "rgba(255,255,255,0.05)" : "transparent",
                  color: exportTab === "terraform" ? "var(--theme-purple)" : "var(--text-secondary)",
                  border: "none",
                  borderBottom: exportTab === "terraform" ? "2px solid var(--theme-purple)" : "2px solid transparent",
                  fontWeight: 600,
                  fontSize: "11px",
                  cursor: "pointer"
                }}
                onClick={() => setExportTab("terraform")}
              >
                Terraform IaC
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "10px", lineHeight: "1.4" }}>
                {exportTab === "mermaid" && "Copy this Mermaid markdown code to draw live diagrams in GitHub wikis or README comments."}
                {exportTab === "sql" && "Copy this SQL schema script to configure tables and foreign key relations in your database migrations."}
                {exportTab === "typescript" && "Copy these TypeScript models and interfaces to type-safely structure your backend database records and API endpoint request payloads."}
                {exportTab === "docker" && "Copy this docker-compose.yml configuration to launch local container instances of servers, databases, queues, and object storage."}
                {exportTab === "terraform" && "Copy this AWS Terraform configuration to provision cloud storage buckets, container systems, and database layers dynamically."}
              </p>
              <textarea
                className="modal-textarea"
                style={{
                  height: "260px",
                  color: exportTab === "mermaid" ? "var(--theme-blue)" : 
                         exportTab === "sql" ? "var(--theme-orange)" : 
                         exportTab === "typescript" ? "var(--theme-green)" : 
                         exportTab === "docker" ? "var(--theme-indigo)" : "var(--theme-purple)"
                }}
                readOnly
                value={getCodeForTab()}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" style={{ width: "auto" }} onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{
                  width: "auto",
                  padding: "8px 16px",
                  background: exportTab === "mermaid" ? "var(--theme-blue)" : 
                              exportTab === "sql" ? "var(--theme-orange)" : 
                              exportTab === "typescript" ? "var(--theme-green)" : 
                              exportTab === "docker" ? "var(--theme-indigo)" : "var(--theme-purple)",
                  color: "#000"
                }}
                onClick={copyToClipboard}
              >
                Copy Specs Code
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
