#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
// 💧 Spraay Solana MCP Server
// AI agents discover & use Spraay batch payments via MCP
// Publish to Smithery alongside the Base MCP server
// ═══════════════════════════════════════════════════════

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { tools, GATEWAY_URL } from './tools.js';

const server = new Server(
  {
    name: 'spraay-solana',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let url;
    let method;
    let body;

    switch (name) {
      case 'spraay_solana_batch_send_sol':
        url = `${GATEWAY_URL}/solana/batch-send-sol`;
        method = 'POST';
        body = JSON.stringify({ recipients: args.recipients });
        break;

      case 'spraay_solana_batch_send_token':
        url = `${GATEWAY_URL}/solana/batch-send-token`;
        method = 'POST';
        body = JSON.stringify({ mint: args.mint, recipients: args.recipients });
        break;

      case 'spraay_solana_quote':
        const params = new URLSearchParams({ recipients: String(args.recipients) });
        if (args.token) params.set('token', args.token);
        url = `${GATEWAY_URL}/solana/quote?${params}`;
        method = 'GET';
        break;

      case 'spraay_solana_tx_status':
        url = `${GATEWAY_URL}/solana/status/${args.txid}`;
        method = 'GET';
        break;

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    const fetchOptions = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) fetchOptions.body = body;

    const response = await fetch(url, fetchOptions);

    // Handle x402 payment required
    if (response.status === 402) {
      const paymentInfo = await response.json();
      return {
        content: [{
          type: 'text',
          text: `Payment required: ${JSON.stringify(paymentInfo, null, 2)}\n\n` +
                `This endpoint requires x402 payment. Send USDC on Solana to the payTo address, ` +
                `then include the tx signature in the X-PAYMENT header.`,
        }],
        isError: true,
      };
    }

    const data = await response.json();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2),
      }],
    };

  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `Error calling ${name}: ${err.message}`,
      }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('💧 Spraay Solana MCP Server running');
}

main().catch(console.error);
