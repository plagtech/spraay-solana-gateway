import { Router } from 'express';
import config from '../config.js';

const router = Router();

router.get('/', (req, res) => {
  const { recipients, token } = req.query;
  const count = parseInt(recipients) || 1;
  const isSOL = !token || token.toUpperCase() === 'SOL';

  const maxPerTx = isSOL
    ? config.MAX_INSTRUCTIONS_PER_TX
    : config.MAX_INSTRUCTIONS_PER_TX_TOKEN;

  const txCount = Math.ceil(count / maxPerTx);
  const networkFee = txCount * 0.000005; // ~5000 lamports per tx
  const ataFee = isSOL ? 0 : count * 0.00204; // ATA rent per recipient (worst case)

  res.json({
    recipients: count,
    token: isSOL ? 'SOL' : token,
    transactions: txCount,
    maxPerTransaction: maxPerTx,
    estimatedNetworkFee: `${(networkFee + ataFee).toFixed(6)} SOL`,
    ataRentNote: isSOL
      ? null
      : `Up to ${(ataFee).toFixed(6)} SOL if all ${count} recipients need new token accounts`,
    spraayFee: `${config.GATEWAY_FEE_PERCENT}% of total amount`,
    gatewayFee: '$0.01 USDC (x402 per request)',
    estimatedTime: `~${Math.max(1, Math.ceil(txCount * 0.5))}s`,
  });
});

export default router;
