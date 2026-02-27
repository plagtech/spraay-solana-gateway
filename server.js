// ═══════════════════════════════════════════════════════════════
// 💧 Spraay Solana Gateway — x402 Payment Gateway for AI Agents
// ═══════════════════════════════════════════════════════════════
//
// AI agents pay $0.01 USDC per batch request via x402 protocol.
// Gateway executes batch SOL/SPL token transfers on Solana.
//
// Powered by: @x402/express + @x402/svm (Coinbase x402 protocol)
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import config from './src/config.js';

// Route handlers
import healthRouter from './src/routes/health.js';
import batchSendSOLRouter from './src/routes/batchSendSOL.js';
import batchSendTokenRouter from './src/routes/batchSendToken.js';
import quoteRouter from './src/routes/quote.js';
import statusRouter from './src/routes/status.js';

const app = express();
app.use(cors());
app.use(express.json());

// ── Health check (free, no x402) ──
app.use('/health', healthRouter);

// ── x402 Payment Setup ──
const facilitatorClient = new HTTPFacilitatorClient({
  url: config.FACILITATOR_URL,
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(config.X402_NETWORK, new ExactSvmScheme());

// Route config: maps endpoints to x402 payment requirements
const routes = {
  'POST /solana/batch-send-sol': {
    accepts: [{
      scheme: 'exact',
      price: '$0.01',
      network: config.X402_NETWORK,
      payTo: config.TREASURY_WALLET,
    }],
    description: 'Batch send SOL to multiple Solana wallets (up to 1000 recipients)',
    mimeType: 'application/json',
  },
  'POST /solana/batch-send-token': {
    accepts: [{
      scheme: 'exact',
      price: '$0.01',
      network: config.X402_NETWORK,
      payTo: config.TREASURY_WALLET,
    }],
    description: 'Batch send any SPL token (USDC, BONK, WIF, etc.) to multiple wallets',
    mimeType: 'application/json',
  },
  'GET /solana/quote': {
    accepts: [{
      scheme: 'exact',
      price: '$0.001',
      network: config.X402_NETWORK,
      payTo: config.TREASURY_WALLET,
    }],
    description: 'Get cost estimate for a batch send',
    mimeType: 'application/json',
  },
  'GET /solana/status/*': {
    accepts: [{
      scheme: 'exact',
      price: '$0.001',
      network: config.X402_NETWORK,
      payTo: config.TREASURY_WALLET,
    }],
    description: 'Check transaction status by signature',
    mimeType: 'application/json',
  },
};

// Apply x402 middleware — protects all routes defined above
app.use(paymentMiddleware(routes, resourceServer, undefined, undefined, false));

// ── Protected Routes (require x402 payment) ──
app.use('/solana/batch-send-sol', batchSendSOLRouter);
app.use('/solana/batch-send-token', batchSendTokenRouter);
app.use('/solana/quote', quoteRouter);
app.use('/solana/status', statusRouter);

// ── x402 Discovery Manifest ──
app.get('/.well-known/x402', (req, res) => {
  res.json({
    name: 'Spraay Solana Gateway',
    description: 'Batch payment infrastructure for AI agents on Solana. Send SOL or any SPL token to up to 1000 wallets in one request.',
    version: '1.0.0',
    chain: 'solana',
    network: config.X402_NETWORK,
    endpoints: [
      {
        path: '/solana/batch-send-sol',
        method: 'POST',
        price: '$0.01',
        description: 'Batch send SOL to multiple recipients',
        body: {
          recipients: [{ address: 'string', amount: 'number (SOL)' }],
        },
      },
      {
        path: '/solana/batch-send-token',
        method: 'POST',
        price: '$0.01',
        description: 'Batch send any SPL token to multiple recipients',
        body: {
          mint: 'string (SPL token mint address)',
          recipients: [{ address: 'string', amount: 'number (token units)' }],
        },
      },
      {
        path: '/solana/quote',
        method: 'GET',
        price: '$0.001',
        description: 'Get cost estimate for a batch send',
        params: { recipients: 'number', token: 'string (optional)' },
      },
      {
        path: '/solana/status/:txid',
        method: 'GET',
        price: '$0.001',
        description: 'Check transaction status',
        params: { txid: 'string (Solana tx signature)' },
      },
    ],
    payment: {
      chain: 'solana',
      network: config.X402_NETWORK,
      token: 'USDC',
      address: config.TREASURY_WALLET,
    },
    links: {
      website: 'https://spraay.app',
      docs: 'https://gateway-solana.spraay.app/.well-known/x402',
      github: 'https://github.com/plagtech/spraay-solana-gateway',
      twitter: 'https://twitter.com/Spraay_app',
    },
  });
});

// ── Root ──
app.get('/', (req, res) => {
  res.json({
    service: '💧 Spraay Solana Gateway',
    description: 'x402-powered batch payment infrastructure for AI agents on Solana',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health (free)',
      batchSendSOL: 'POST /solana/batch-send-sol ($0.01)',
      batchSendToken: 'POST /solana/batch-send-token ($0.01)',
      quote: 'GET /solana/quote ($0.001)',
      status: 'GET /solana/status/:txid ($0.001)',
      manifest: 'GET /.well-known/x402 (free)',
    },
    network: config.NETWORK,
    x402: {
      protocol: 'x402 v2',
      scheme: 'exact',
      network: config.X402_NETWORK,
      facilitator: config.FACILITATOR_URL,
      payment: 'USDC on Solana',
    },
  });
});

// ── Start ──
app.listen(config.PORT, () => {
  console.log(`\n💧 Spraay Solana Gateway v1.0.0`);
  console.log(`   Network:     ${config.NETWORK} (${config.X402_NETWORK})`);
  console.log(`   Treasury:    ${config.TREASURY_WALLET}`);
  console.log(`   Facilitator: ${config.FACILITATOR_URL}`);
  console.log(`   Port:        ${config.PORT}`);
  console.log(`   Ready!\n`);
});
