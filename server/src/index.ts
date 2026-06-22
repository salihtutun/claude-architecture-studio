import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import open from "open";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DiagramState, ReactFlowNode, ReactFlowEdge, ClientMessage, ServerMessage } from "./types.js";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File persistence paths
const DIAGRAM_FILE_NAME = "cas-diagram.json";
const WORKSPACE_DIR = process.cwd();
const DIAGRAM_FILE_PATH = path.join(WORKSPACE_DIR, DIAGRAM_FILE_NAME);

// Fallback diagram state
const STARTER_DIAGRAM: DiagramState = {
  nodes: [
    {
      id: "node-client",
      type: "client",
      position: { x: 80, y: 180 },
      data: {
        label: "React Web App",
        description: "User-facing web browser application",
        themeColor: "blue"
      }
    },
    {
      id: "node-gateway",
      type: "cloud",
      position: { x: 340, y: 180 },
      data: {
        label: "API Gateway",
        description: "Nginx ingress and auth verification layer",
        themeColor: "purple"
      }
    },
    {
      id: "node-server",
      type: "server",
      position: { x: 600, y: 120 },
      data: {
        label: "Express REST API",
        description: "Core server handling user actions and orders",
        themeColor: "green",
        endpoints: [
          { method: "GET", path: "/api/users", description: "Get profile details" },
          { method: "POST", path: "/api/orders", description: "Create a new checkout order" }
        ]
      }
    },
    {
      id: "node-db",
      type: "database",
      position: { x: 880, y: 140 },
      data: {
        label: "PostgreSQL DB",
        description: "Primary relational database",
        themeColor: "orange",
        tables: [
          {
            name: "users",
            columns: [
              { name: "id", type: "UUID", isPK: true },
              { name: "email", type: "text", isPK: false },
              { name: "created_at", type: "timestamp", isPK: false }
            ]
          },
          {
            name: "orders",
            columns: [
              { name: "id", type: "UUID", isPK: true },
              { name: "user_id", type: "UUID", isPK: false },
              { name: "total", type: "decimal", isPK: false },
              { name: "status", type: "text", isPK: false }
            ]
          }
        ]
      }
    }
  ],
  edges: [
    {
      id: "edge-client-gateway",
      source: "node-client",
      target: "node-gateway",
      label: "HTTPS/WSS",
      animated: true,
      type: "smoothstep"
    },
    {
      id: "edge-gateway-server",
      source: "node-gateway",
      target: "node-server",
      label: "Proxy REST",
      animated: true,
      type: "smoothstep"
    },
    {
      id: "edge-server-db",
      source: "node-server",
      target: "node-db",
      label: "SQL query",
      animated: true,
      type: "smoothstep"
    }
  ],
  updatedAt: new Date().toISOString()
};

// Global Diagram State
let diagramState: DiagramState = { ...STARTER_DIAGRAM };

// Load diagram from file if exists
const loadDiagramFromFile = () => {
  try {
    if (fs.existsSync(DIAGRAM_FILE_PATH)) {
      const content = fs.readFileSync(DIAGRAM_FILE_PATH, "utf8");
      diagramState = JSON.parse(content);
      console.error(`[CAS Server] Successfully loaded diagram from ${DIAGRAM_FILE_PATH}`);
    } else {
      console.error(`[CAS Server] No diagram file found. Initializing with starter diagram.`);
      saveDiagramToFile();
    }
  } catch (err) {
    console.error(`[CAS Server] Error reading diagram file:`, err);
  }
};

// Save diagram to file
const saveDiagramToFile = () => {
  try {
    diagramState.updatedAt = new Date().toISOString();
    fs.writeFileSync(DIAGRAM_FILE_PATH, JSON.stringify(diagramState, null, 2), "utf8");
    console.error(`[CAS Server] Saved diagram state to ${DIAGRAM_FILE_PATH}`);
  } catch (err) {
    console.error(`[CAS Server] Error writing diagram file:`, err);
  }
};

// Initialize server states
loadDiagramFromFile();

// Define Web UI Port
const DEFAULT_PORT = 9000;
let activePort = DEFAULT_PORT;

// Web UI Clients List
const wsClients = new Set<WebSocket>();

// Broadcast to Web UIs
const broadcastState = (sender?: WebSocket) => {
  const message: ServerMessage = {
    type: "sync_state",
    payload: {
      ...diagramState,
      hasMcpConnection: true
    }
  };
  const stringified = JSON.stringify(message);

  for (const client of wsClients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(stringified);
    }
  }
};

// Initialize Express + WebSocket Server
const app = express();
app.use(cors());
app.use(express.json());

// Serve static web app files
const frontendDistPath = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  console.error(`[CAS Server] Serving compiled frontend from: ${frontendDistPath}`);
} else {
  // If not yet compiled, serve an instructional page
  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Claude Architecture Studio</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3); max-width: 500px; }
          h1 { margin-top: 0; color: #38bdf8; }
          code { background: #0f172a; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-family: monospace; color: #f472b6; }
          p { line-height: 1.6; color: #94a3b8; }
          .btn { display: inline-block; margin-top: 1.5rem; background: #0284c7; color: white; padding: 0.5rem 1rem; text-decoration: none; border-radius: 0.375rem; font-weight: bold; }
          .btn:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Claude Architecture Studio</h1>
          <p>The backend MCP server is running on port <strong>${activePort}</strong>!</p>
          <p>However, the React frontend is not compiled yet. Please run <code>npm run build:all</code> in your workspace root, then refresh this page.</p>
          <p>Alternatively, if you're developing, run the dev server with <code>npm run dev</code>.</p>
        </div>
      </body>
      </html>
    `);
  });
}

// HTTP API Endpoints for easy reading/writing
app.get("/api/diagram", (_req, res) => {
  res.json(diagramState);
});

app.post("/api/diagram", (req, res) => {
  if (req.body && Array.isArray(req.body.nodes) && Array.isArray(req.body.edges)) {
    diagramState.nodes = req.body.nodes;
    diagramState.edges = req.body.edges;
    saveDiagramToFile();
    broadcastState();
    res.json({ success: true, diagramState });
  } else {
    res.status(400).json({ error: "Invalid diagram state payload" });
  }
});

// Start Express HTTP Server
const serverInstance = app.listen(DEFAULT_PORT, () => {
  console.error(`[CAS Server] Web interface running on http://localhost:${DEFAULT_PORT}`);
}).on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[CAS Server] Port ${DEFAULT_PORT} is in use. Finding next available...`);
    const tempServer = app.listen(0, () => {
      const address = tempServer.address();
      if (address && typeof address === "object") {
        activePort = address.port;
        console.error(`[CAS Server] Web interface running on http://localhost:${activePort}`);
      }
    });
  } else {
    console.error(`[CAS Server] Server start error:`, err);
  }
});

// Setup WebSocket Server
const wss = new WebSocketServer({ server: serverInstance });

wss.on("connection", (ws) => {
  wsClients.add(ws);
  console.error(`[CAS Server] Web UI Client connected (total: ${wsClients.size})`);

  // Send initial state
  const welcomeMsg: ServerMessage = {
    type: "sync_state",
    payload: {
      ...diagramState,
      hasMcpConnection: true
    }
  };
  ws.send(JSON.stringify(welcomeMsg));

  ws.on("message", (rawMessage) => {
    try {
      const msg = JSON.parse(rawMessage.toString()) as ClientMessage;
      if (msg.type === "user_update" && msg.payload) {
        // Apply user edits from browser
        if (msg.payload.nodes) diagramState.nodes = msg.payload.nodes as ReactFlowNode[];
        if (msg.payload.edges) diagramState.edges = msg.payload.edges as ReactFlowEdge[];
        saveDiagramToFile();
        
        // Broadcast user's changes to other open tabs
        broadcastState(ws);
      } else if (msg.type === "request_state") {
        ws.send(JSON.stringify({
          type: "sync_state",
          payload: diagramState
        }));
      }
    } catch (err) {
      console.error("[CAS Server] WebSocket message parse error:", err);
    }
  });

  ws.on("close", () => {
    wsClients.delete(ws);
    console.error(`[CAS Server] Web UI Client disconnected (total: ${wsClients.size})`);
  });
});

// ==========================================
// MCP Server Logic
// ==========================================

const mcpServer = new Server(
  {
    name: "claude-architecture-studio",
    version: "1.0.0"
  },
  {
    capabilities: {
      resources: {},
      tools: {}
    }
  }
);

// Register MCP resources
mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "diagram://state",
        name: "Current Architecture Diagram",
        mimeType: "application/json",
        description: "The live JSON diagram layout and design currently loaded."
      }
    ]
  };
});

mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "diagram://state") {
    return {
      contents: [
        {
          uri: "diagram://state",
          mimeType: "application/json",
          text: JSON.stringify(diagramState, null, 2)
        }
      ]
    };
  }
  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${request.params.uri}`);
});

// Register MCP tools
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_diagram",
        description: "Retrieve the current state of the architecture diagram (nodes, layout coordinates, and connections). Use this to understand what is on the canvas.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "set_diagram",
        description: "Overwrite the entire diagram state with new lists of nodes and edges.",
        inputSchema: {
          type: "object",
          properties: {
            nodes: {
              type: "array",
              description: "Array of node objects.",
              items: { type: "object" }
            },
            edges: {
              type: "array",
              description: "Array of edge connection objects.",
              items: { type: "object" }
            }
          },
          required: ["nodes", "edges"]
        }
      },
      {
        name: "add_node",
        description: "Add a single node to the architecture diagram.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Unique identifier for this node (e.g. 'web-client', 'orders-db')." },
            type: {
              type: "string",
              description: "The component type. Choose from: 'client' (browser/mobile), 'server' (API/backend), 'database' (SQL/NoSQL database), 'queue' (RabbitMQ/Kafka), 'storage' (S3 bucket/FS), 'auth' (Identity/Auth service), 'cloud' (load balancer/gateway), or 'external' (third party API like Stripe/OpenAI).",
              enum: ["client", "server", "database", "queue", "storage", "auth", "cloud", "external"]
            },
            label: { type: "string", description: "Human-readable label for the node." },
            description: { type: "string", description: "Brief subtext describing the node's function." },
            x: { type: "number", description: "Horizontal grid coordinate (typically between 50 and 1200)." },
            y: { type: "number", description: "Vertical grid coordinate (typically between 50 and 800)." },
            endpoints: {
              type: "array",
              description: "For 'server' nodes, list of API routes: { method, path, description }",
              items: {
                type: "object",
                properties: {
                  method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "WS"] },
                  path: { type: "string" },
                  description: { type: "string" }
                },
                required: ["method", "path"]
              }
            },
            tables: {
              type: "array",
              description: "For 'database' nodes, list of tables/schemas: { name, columns }",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  columns: { type: "array", items: { type: "string" } }
                },
                required: ["name", "columns"]
              }
            },
            themeColor: {
              type: "string",
              description: "Styling color tag.",
              enum: ["blue", "green", "purple", "orange", "red", "indigo"]
            }
          },
          required: ["id", "type", "label", "x", "y"]
        }
      },
      {
        name: "update_node",
        description: "Modify an existing node's label, description, coordinates, color, or special content (endpoints, tables). Values not supplied will remain unchanged.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "The ID of the node to update." },
            label: { type: "string" },
            description: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            endpoints: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  method: { type: "string" },
                  path: { type: "string" },
                  description: { type: "string" }
                },
                required: ["method", "path"]
              }
            },
            tables: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  columns: { type: "array", items: { type: "string" } }
                },
                required: ["name", "columns"]
              }
            },
            themeColor: {
              type: "string",
              enum: ["blue", "green", "purple", "orange", "red", "indigo"]
            }
          },
          required: ["id"]
        }
      },
      {
        name: "remove_node",
        description: "Delete a node from the canvas and disconnect all of its edges.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Node ID to remove." }
          },
          required: ["id"]
        }
      },
      {
        name: "add_edge",
        description: "Draw an arrow / data path connecting two nodes.",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string", description: "ID of the source node." },
            target: { type: "string", description: "ID of the target node." },
            label: { type: "string", description: "Text description centered on the connection (e.g. 'gRPC', 'JDBC', 'REST')." },
            animated: { type: "boolean", description: "If true, renders animated pulses showing data flow. Defaults to true." },
            type: { type: "string", description: "Edge style: 'smoothstep', 'straight', 'step', or 'bezier'. Defaults to 'smoothstep'." }
          },
          required: ["source", "target"]
        }
      },
      {
        name: "remove_edge",
        description: "Disconnect two nodes. Provide either the unique edge ID, or the source and target node IDs.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Specific edge ID to remove." },
            source: { type: "string", description: "Source node ID." },
            target: { type: "string", description: "Target node ID." }
          }
        }
      },
      {
        name: "clear_diagram",
        description: "Delete all nodes and edges from the canvas.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "open_in_browser",
        description: "Open the interactive diagram in the web browser.",
        inputSchema: { type: "object", properties: {} }
      }
    ]
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_diagram": {
        return {
          content: [{ type: "text", text: JSON.stringify(diagramState, null, 2) }]
        };
      }

      case "set_diagram": {
        const { nodes, edges } = args as { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] };
        diagramState.nodes = nodes;
        diagramState.edges = edges;
        saveDiagramToFile();
        broadcastState();
        return {
          content: [{ type: "text", text: `Successfully updated diagram with ${nodes.length} nodes and ${edges.length} edges.` }]
        };
      }

      case "add_node": {
        const p = args as {
          id: string;
          type: string;
          label: string;
          description?: string;
          x: number;
          y: number;
          endpoints?: any[];
          tables?: any[];
          themeColor?: string;
        };

        // Check duplicate ID
        if (diagramState.nodes.some(n => n.id === p.id)) {
          throw new McpError(ErrorCode.InvalidParams, `Node with ID '${p.id}' already exists.`);
        }

        const newNode: ReactFlowNode = {
          id: p.id,
          type: p.type,
          position: { x: p.x, y: p.y },
          data: {
            label: p.label,
            description: p.description,
            endpoints: p.endpoints,
            tables: p.tables,
            themeColor: p.themeColor || "blue"
          }
        };

        diagramState.nodes.push(newNode);
        saveDiagramToFile();
        broadcastState();
        return {
          content: [{ type: "text", text: `Node '${p.id}' successfully added at (${p.x}, ${p.y}).` }]
        };
      }

      case "update_node": {
        const p = args as {
          id: string;
          label?: string;
          description?: string;
          x?: number;
          y?: number;
          endpoints?: any[];
          tables?: any[];
          themeColor?: string;
        };

        const idx = diagramState.nodes.findIndex(n => n.id === p.id);
        if (idx === -1) {
          throw new McpError(ErrorCode.InvalidParams, `Node with ID '${p.id}' not found.`);
        }

        const node = diagramState.nodes[idx];
        if (p.label !== undefined) node.data.label = p.label;
        if (p.description !== undefined) node.data.description = p.description;
        if (p.endpoints !== undefined) node.data.endpoints = p.endpoints;
        if (p.tables !== undefined) node.data.tables = p.tables;
        if (p.themeColor !== undefined) node.data.themeColor = p.themeColor;
        if (p.x !== undefined) node.position.x = p.x;
        if (p.y !== undefined) node.position.y = p.y;

        saveDiagramToFile();
        broadcastState();
        return {
          content: [{ type: "text", text: `Node '${p.id}' successfully updated.` }]
        };
      }

      case "remove_node": {
        const { id } = args as { id: string };
        const originalCount = diagramState.nodes.length;
        diagramState.nodes = diagramState.nodes.filter(n => n.id !== id);
        
        if (diagramState.nodes.length === originalCount) {
          throw new McpError(ErrorCode.InvalidParams, `Node with ID '${id}' not found.`);
        }

        // Clean up connected edges
        diagramState.edges = diagramState.edges.filter(e => e.source !== id && e.target !== id);

        saveDiagramToFile();
        broadcastState();
        return {
          content: [{ type: "text", text: `Node '${id}' and its connection paths successfully removed.` }]
        };
      }

      case "add_edge": {
        const p = args as {
          source: string;
          target: string;
          label?: string;
          animated?: boolean;
          type?: string;
        };

        // Validate node existences
        if (!diagramState.nodes.some(n => n.id === p.source)) {
          throw new McpError(ErrorCode.InvalidParams, `Source node '${p.source}' does not exist.`);
        }
        if (!diagramState.nodes.some(n => n.id === p.target)) {
          throw new McpError(ErrorCode.InvalidParams, `Target node '${p.target}' does not exist.`);
        }

        const edgeId = `edge-${p.source}-${p.target}`;
        
        // Remove existing identical edge if it exists
        diagramState.edges = diagramState.edges.filter(e => e.id !== edgeId);

        const newEdge: ReactFlowEdge = {
          id: edgeId,
          source: p.source,
          target: p.target,
          label: p.label,
          animated: p.animated !== false, // Default to true
          type: p.type || "smoothstep"
        };

        diagramState.edges.push(newEdge);
        saveDiagramToFile();
        broadcastState();
        return {
          content: [{ type: "text", text: `Edge successfully created connecting '${p.source}' to '${p.target}'.` }]
        };
      }

      case "remove_edge": {
        const p = args as { id?: string; source?: string; target?: string };
        let removed = false;

        if (p.id) {
          const originalLength = diagramState.edges.length;
          diagramState.edges = diagramState.edges.filter(e => e.id !== p.id);
          removed = diagramState.edges.length < originalLength;
        } else if (p.source && p.target) {
          const originalLength = diagramState.edges.length;
          diagramState.edges = diagramState.edges.filter(
            e => !(e.source === p.source && e.target === p.target)
          );
          removed = diagramState.edges.length < originalLength;
        } else {
          throw new McpError(ErrorCode.InvalidParams, "Must specify 'id' or both 'source' and 'target' properties.");
        }

        if (!removed) {
          return {
            content: [{ type: "text", text: "No matching connection path was found to remove." }]
          };
        }

        saveDiagramToFile();
        broadcastState();
        return {
          content: [{ type: "text", text: "Connection successfully removed." }]
        };
      }

      case "clear_diagram": {
        diagramState.nodes = [];
        diagramState.edges = [];
        saveDiagramToFile();
        broadcastState();
        return {
          content: [{ type: "text", text: "Diagram successfully cleared." }]
        };
      }

      case "open_in_browser": {
        const url = `http://localhost:${activePort}`;
        await open(url);
        return {
          content: [{ type: "text", text: `Opened browser to: ${url}` }]
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err: any) {
    if (err instanceof McpError) throw err;
    throw new McpError(ErrorCode.InternalError, err.message || "An unexpected internal error occurred.");
  }
});

// Run MCP Stdio Transport
async function runMcpServer() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error("[CAS Server] Claude Architecture Studio MCP Server connected on Stdio transport.");
}

runMcpServer().catch((error) => {
  console.error("[CAS Server] Critical error running MCP Server:", error);
});
