# 📊 Claude Architecture Studio (CAS)

An interactive diagram, flowchart, and architecture designer for Claude.

Claude Architecture Studio is a custom Model Context Protocol (MCP) server that empowers Claude to design system architectures, databases, and message flows visually using React Flow. It hosts a real-time updating web editor that displays live changes as Claude edits, and allows the developer to customize node coordinates, texts, and styles from a premium browser UI—synced back to Claude.

## 🚀 Features

- **Live Updating Canvas**: Witness architecture diagrams appear and modify in real-time.
- **Bi-directional Syncing**: Both Claude and the developer can add, modify, delete, and layout nodes or connections. Edits made in the browser sync back to Claude.
- **Premium Themes & Specialized Nodes**: Beautiful dark mode and specialized nodes for Clients, Databases (SQL/NoSQL with table schemas), Servers (API endpoints), Message Queues, Cloud Gateways, Storage, and Auth systems.
- **Interactive Connections**: Visual flow of data with customizable speeds, styles, and labels.
- **Exporting options**: Instant export to PNG, SVG, or Mermaid code.
- **Auto Layout**: Layout the nodes automatically using tree/grid layout modes.

---

## 🛠️ Installation & Setup

1. **Install Dependencies & Build**:
   ```bash
   # Run from the root directory
   npm run install:all
   npm run build:all
   ```

2. **Run the Server**:
   ```bash
   # Start the MCP server
   npm start
   ```

## ⚙️ Integrating with Claude Desktop

Add this configuration to your Claude Desktop configuration file (usually located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "claude-architecture-studio": {
      "command": "node",
      "args": [
        "/Users/salihtutun/Downloads/CAS/server/dist/index.js"
      ]
    }
  }
}
```

Make sure to restart Claude Desktop after saving the configuration file.

---

## 🔧 MCP Tools Exposed

- `get_diagram`: Retrieve the current JSON state of nodes and edges.
- `set_diagram`: Set the entire canvas state.
- `add_node`: Add a node with customized styles and data.
- `update_node`: Update a node's parameters, endpoints, styles, or labels.
- `remove_node`: Remove a node and its connections.
- `add_edge`: Create a data flow connection between two nodes with labels and animations.
- `remove_edge`: Delete an existing connection.
- `clear_diagram`: Reset the diagram.
- `open_in_browser`: Open the interactive editor in your default browser.
