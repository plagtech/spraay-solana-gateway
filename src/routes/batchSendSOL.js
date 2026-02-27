import { Router } from 'express';
import { batchSendSOL } from '../solana/batchSendSOL.js';
import { validateRecipients } from '../utils/validation.js';
import { logRequest } from '../utils/logger.js';

const router = Router();

router.post('/', async (req, res) => {
  logRequest(req, `batch-send-sol — ${req.body?.recipients?.length || 0} recipients`);

  try {
    const { recipients } = req.body;

    const validation = validateRecipients(recipients);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await batchSendSOL(recipients);
    res.json(result);

  } catch (err) {
    console.error('batch-send-sol error:', err);
    res.status(500).json({
      error: 'Batch send SOL failed',
      details: err.message,
    });
  }
});

export default router;
