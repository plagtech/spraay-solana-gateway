import { Router } from 'express';
import config from '../config.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Spraay Solana Gateway',
    version: '1.0.0',
    network: config.NETWORK,
    x402Network: config.X402_NETWORK,
    treasury: config.TREASURY_WALLET,
    timestamp: new Date().toISOString(),
  });
});

export default router;
