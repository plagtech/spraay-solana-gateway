// mcp/mcpStreamable.js
// ═══════════════════════════════════════════════════════════════
// 💧 Spraay Solana Gateway — MCP Streamable HTTP Endpoint
// ═══════════════════════════════════════════════════════════════
//
// Provides Streamable HTTP MCP transport at /mcp for Smithery
// registry and any MCP client (Claude Desktop, Cursor, etc.)
//
// Tools exposed:
//   - spraay_solana_batch_send_sol
//   - spraay_solana_batch_send_token
//   - spraay_solana_quote
//   - spraay_solana_status
// ═══════════════════════════════════════════════════════════════

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import crypto from 'crypto';

const GATEWAY_URL = process.env.GATEWAY_URL || 'https://gateway-solana.spraay.app';

function createMcpServer() {
  const server = new McpServer({
    name: 'spraay-solana-gateway',
    version: '1.0.0',
  });

  // Tool: Batch send SOL
  server.tool(
    'spraay_solana_batch_send_sol',
    'Batch send SOL to multiple Solana wallets in one call. Supports up to 1000 recipients. Auto-chunks large batches. Costs $0.01 USDC via x402 protocol.',
    {
      recipients: z.array(
        z.object({
          address: z.string().describe('Solana wallet address (base58)'),
          amount: z.number().positive().describe('Amount of SOL to send'),
        })
      ).min(1).max(1000).describe('Array of recipients'),
    },
    async ({ recipients }) => {
      try {
        const res = await fetch(`${GATEWAY_URL}/solana/batch-send-sol`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients }),
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // Tool: Batch send SPL token
  server.tool(
    'spraay_solana_batch_send_token',
    'Batch send any SPL token (USDC, BONK, WIF, JUP, etc.) to multiple Solana wallets. Auto-creates token accounts. Costs $0.01 USDC via x402.',
    {
      mint: z.string().describe('SPL token mint address (base58)'),
      recipients: z.array(
        z.object({
          address: z.string().describe('Solana wallet address (base58)'),
          amount: z.number().positive().describe('Amount of tokens to send'),
        })
      ).min(1).max(1000).describe('Array of recipients'),
    },
    async ({ mint, recipients }) => {
      try {
        const res = await fetch(`${GATEWAY_URL}/solana/batch-send-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mint, recipients }),
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // Tool: Get quote
  server.tool(
    'spraay_solana_quote',
    'Get a cost estimate for a Spraay batch send on Solana. Returns fees, tx count, and timing. Costs $0.001 USDC via x402.',
    {
      recipients: z.number().positive().describe('Number of recipients'),
      token: z.string().optional().describe('Token symbol: SOL, USDC, BONK, etc.'),
    },
    async ({ recipients, token }) => {
      try {
        const params = new URLSearchParams({ recipients: String(recipients) });
        if (token) params.set('token', token);
        const res = await fetch(`${GATEWAY_URL}/solana/quote?${params}`);
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // Tool: Check tx status
  server.tool(
    'spraay_solana_status',
    'Check the status of a Solana transaction by its signature. Costs $0.001 USDC via x402.',
    {
      txid: z.string().describe('Solana transaction signature'),
    },
    async ({ txid }) => {
      try {
        const res = await fetch(`${GATEWAY_URL}/solana/status/${txid}`);
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  return server;
}

// Session management
const transports = {};

export function setupMcpRoutes(app) {
  // POST /mcp — main MCP protocol endpoint
  app.post('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'];

      let transport;
      if (sessionId && transports[sessionId]) {
        // Existing session
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New session
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });

        const server = createMcpServer();
        await server.connect(transport);

        // Clean up on close
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) delete transports[sid];
        };
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Bad request: missing session ID or not initialize' },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);

      // Store transport after handling (session ID is set during handleRequest)
      if (transport.sessionId && !transports[transport.sessionId]) {
        transports[transport.sessionId] = transport;
      }
    } catch (err) {
      console.error('MCP POST error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal MCP error' },
          id: null,
        });
      }
    }
  });

  // GET /mcp — SSE stream for server notifications
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports[sessionId]) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid or missing session ID' },
        id: null,
      });
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  // DELETE /mcp — terminate session
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId && transports[sessionId]) {
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
      delete transports[sessionId];
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid or missing session ID' },
        id: null,
      });
    }
  });

  console.log('   MCP:         /mcp (Streamable HTTP)');
}
