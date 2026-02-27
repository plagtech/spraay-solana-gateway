import { PublicKey } from '@solana/web3.js';
import config from '../config.js';

/**
 * Validate a Solana address (base58 public key)
 */
export function isValidSolanaAddress(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate recipients array for batch send
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateRecipients(recipients) {
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return { valid: false, error: 'recipients array is required and must not be empty' };
  }

  if (recipients.length > config.MAX_RECIPIENTS) {
    return { valid: false, error: `Max ${config.MAX_RECIPIENTS} recipients per request` };
  }

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];

    if (!r.address || !isValidSolanaAddress(r.address)) {
      return { valid: false, error: `Invalid Solana address at index ${i}: ${r.address}` };
    }

    if (typeof r.amount !== 'number' || r.amount <= 0 || !isFinite(r.amount)) {
      return { valid: false, error: `Invalid amount at index ${i}: ${r.amount}` };
    }
  }

  return { valid: true };
}

/**
 * Validate SPL token mint address
 */
export function validateMint(mint) {
  if (!mint || !isValidSolanaAddress(mint)) {
    return { valid: false, error: 'Valid SPL token mint address is required' };
  }
  return { valid: true };
}
