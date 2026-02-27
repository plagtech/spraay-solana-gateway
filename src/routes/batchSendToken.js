import { Router } from 'express';
import { batchSendToken } from '../solana/batchSendToken.js';
import { validateRecipients, validateMint } from '../utils/validation.js';
import { logRequest } from '../utils/logger.js';

const router = Router();

router.post('/', async (req, res) => {
  logRequest(req, `batch-send-token — mint: ${req.body?.mint} — ${req.body?.recipients?.length || 0} recipients`);

  try {
    const { mint, recipients } = req.body;

    const mintValidation = validateMint(mint);
    if (!mintValidation.valid) {
      return res.status(400).json({ error: mintValidation.error });
    }

    const recipientValidation = validateRecipients(recipients);
    if (!recipientValidation.valid) {
      return res.status(400).json({ error: recipientValidation.error });
    }

    const result = await batchSendToken(mint, recipients);
    res.json(result);

  } catch (err) {
    console.error('batch-send-token error:', err);
    res.status(500).json({
      error: 'Batch send token failed',
      details: err.message,
    });
  }
});

export default router;
