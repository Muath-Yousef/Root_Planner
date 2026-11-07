# SOCROOT Topology Studio — MCP & API Integration Guide

This guide details how to integrate the Root Planner / SOCROOT Topology Studio with:
1. **Model Context Protocol (MCP)** via Claude Desktop, Cursor, and custom clients
2. **REST API Endpoints** for remote topology inspection, validation, and bundle export
3. **Gemini AI API** for natural-language organization architecture and security audits

---

## 1. Model Context Protocol (MCP) Integration

The studio supports two distinct MCP transports:
- **Local Stdio Transport**: Standard stdio process communication for local developer agents.
- **Remote HTTP SSE Transport**: Stream-based SSE communication for IDEs and network agents.

### A. Claude Desktop Setup (Stdio)
Add the following configuration to your `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "socroot-pipeline": {
      "command": "node",
      "args": ["/path/to/Root_Planner/scripts/pipeline-mcp-server.mjs"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

### B. Cursor IDE & Remote Clients (HTTP SSE)
In Cursor:
1. Open **Settings** -> **Features** -> **MCP Servers**
2. Click **+ Add New MCP Server**
3. Select **Type**: `SSE`
4. Set **URL**: `http://localhost:3000/sse` (or your deployed server domain `/sse`)

### C. Available MCP Tools
- `get_my_role`: Retrieves the current active role definition (Analyzer, Implementer, Reviewer) and instructions.
- `list_pending_tasks`: Lists all pending and in-progress pipeline tasks.
- `get_pipeline_status`: Returns analytics on tasks, reviews, and test baselines.
- `validate_topology`: Runs Master Reference governance checks against provided nodes and cables.
- `generate_reference_topology`: Generates the canonical reference organization.

---

## 2. REST API Reference

The studio provides clean, standard JSON endpoints:

### `GET /api/health`
Returns system status, MCP capabilities, and AI status.
```bash
curl http://localhost:3000/api/health
```

### `GET /api/pipeline/status`
Returns full pipeline statistics.
```bash
curl http://localhost:3000/api/pipeline/status
```

### `GET /api/mcp/tools`
Lists all available MCP tools in standard format.
```bash
curl http://localhost:3000/api/mcp/tools
```

### `POST /api/mcp/call`
Executes an MCP tool directly via HTTP without requiring an active SSE connection.
```bash
curl -X POST http://localhost:3000/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"name": "get_pipeline_status", "arguments": {}}'
```

### `POST /api/topology/validate`
Validates an organization topology.
```bash
curl -X POST http://localhost:3000/api/topology/validate \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "socroot-core",
    "nodes": [],
    "edges": []
  }'
```

### `POST /api/topology/export`
Exports a validated topology directly to a ZIP bundle.
```bash
curl -X POST http://localhost:3000/api/topology/export \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "socroot-core",
    "nodes": [],
    "edges": []
  }' \
  --output bundle.zip
```

---

## 3. Gemini AI Organization Architect

The studio integrates with Google Gemini (`gemini-3.8-flash` via `@google/genai`):

### `POST /api/ai/generate-topology`
```bash
curl -X POST http://localhost:3000/api/ai/generate-topology \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create an automated compliance and legal review department with daily budget guards",
    "lang": "en"
  }'
```

### `POST /api/ai/audit-topology`
Analyzes your active topology and provides immediate security and governance advice.
```bash
curl -X POST http://localhost:3000/api/ai/audit-topology \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [],
    "edges": [],
    "lang": "ar"
  }'
```

---

## 4. In-App MCP & AI Consoles
Within the studio interface, you can open:
- **📡 MCP Console**: Run any MCP tool directly with live JSON parameter editing and preview results.
- **✨ AI Architect**: Describe digital organizations in natural language to generate structure and audit security guardrails.
