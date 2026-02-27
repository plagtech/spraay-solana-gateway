import { Router } from 'express';
import { getConnection } from '../solana/connection.js';
import config from '../config.js';

const router = Router();

router.get('/:txid', async (req, res) => {
  const { txid } = req.params;
  const connection = getConnection();

  try {
    const [status, tx] = await Promise.all([
      connection.getSignatureStatus(txid),
      connection.getTransaction(txid, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      }),
    ]);

    const clusterParam = config.NETWORK === 'devnet' ? '?cluster=devnet' : '';

    res.json({
      signature: txid,
      status: status?.value?.confirmationStatus || 'unknown',
      err: status?.value?.err || null,
      slot: tx?.slot || null,
      blockTime: tx?.blockTime || null,
      fee: tx?.meta?.fee || null,
      explorer: `https://explorer.solana.com/tx/${txid}${clusterParam}`,
    });
  } catch (err) {
    res.status(404).json({ error: 'Transaction not found', details: err.message });
  }
});

export default router;
