import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_PATH = path.join(__dirname, "server/dist/index.js");

console.error("Starting MCP Server subprocess validation...");

// Spawn server process
const serverProc = spawn("node", [SERVER_PATH]);

let outputBuffer = "";

serverProc.stdout.on("data", (data) => {
  outputBuffer += data.toString();
  tryParseBuffer();
});

serverProc.stderr.on("data", (data) => {
  console.error(`[Server Stderr]: ${data.toString().trim()}`);
});

serverProc.on("close", (code) => {
  console.error(`Server process exited with code ${code}`);
});

// JSON-RPC requests to send
const requests = [
  // 1. List tools
  {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  },
  // 2. Call get_diagram
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "get_diagram",
      arguments: {}
    }
  },
  // 3. Call add_node
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "add_node",
      arguments: {
        id: "node-test-added",
        type: "client",
        label: "Test Added Node",
        description: "Node created via validate-mcp script",
        x: 100,
        y: 100
      }
    }
  }
];

let currentRequestIndex = 0;

function sendNextRequest() {
  if (currentRequestIndex >= requests.length) {
    console.error("\n[SUCCESS] All MCP tools validated successfully!");
    serverProc.kill();
    process.exit(0);
  }

  const req = requests[currentRequestIndex];
  console.error(`\n---> Sending JSON-RPC request (${req.method}, id: ${req.id})`);
  serverProc.stdin.write(JSON.stringify(req) + "\n");
}

function tryParseBuffer() {
  // Since standard MCP communications are line-delimited or simple JSON streams,
  // we attempt to split by newline, or parse single JSON packets.
  const lines = outputBuffer.split("\n");
  // Keep the last incomplete chunk in buffer
  outputBuffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);
      console.error(`<--- Received JSON-RPC response (id: ${response.id})`);
      
      if (response.error) {
        console.error(`[ERROR] JSON-RPC error returned:`, response.error);
        serverProc.kill();
        process.exit(1);
      }

      console.log(JSON.stringify(response, null, 2));

      // Simple validation assertions
      if (response.id === 1) {
        if (!response.result?.tools) {
          console.error("[FAIL] Tool list is empty or invalid format.");
          serverProc.kill();
          process.exit(1);
        }
        console.error(`[PASS] Found ${response.result.tools.length} registered tools.`);
      }

      if (response.id === 2) {
        const textContent = response.result?.content?.[0]?.text;
        if (!textContent) {
          console.error("[FAIL] get_diagram did not return content text.");
          serverProc.kill();
          process.exit(1);
        }
        const state = JSON.parse(textContent);
        console.error(`[PASS] get_diagram returned layout with ${state.nodes.length} nodes.`);
      }

      if (response.id === 3) {
        const textContent = response.result?.content?.[0]?.text;
        if (!textContent || !textContent.includes("successfully added")) {
          console.error("[FAIL] add_node response validation failed.");
          serverProc.kill();
          process.exit(1);
        }
        console.error("[PASS] add_node execution confirmed.");
      }

      currentRequestIndex++;
      sendNextRequest();
    } catch (err) {
      // If parsing failed, restore the line to buffer and wait for more data
      outputBuffer = line + "\n" + outputBuffer;
      break;
    }
  }
}

// Start sequence after 1 second delay to let server boot
setTimeout(() => {
  sendNextRequest();
}, 1000);
