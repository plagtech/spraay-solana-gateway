import {
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { getConnection } from './connection.js';
import config from '../config.js';

// 0.3% from your existing GATEWAY_FEE_PERCENT, expressed in basis points.
const FEE_BPS = Math.round((config.GATEWAY_FEE_PERCENT ?? 0.3) * 100);

/**
 * Build a NON-CUSTODIAL batch SOL transfer.
 *
 * The agent (`sender`) is the source of funds and the fee payer. This function
 * builds the transaction(s) and returns them UNSIGNED and serialized — the
 * agent's own wallet signs and submits. The gateway never holds keys or funds.
 *
 * A 0.3% Spraay protocol fee on the total batch amount is added as a single
 * transfer from `sender` to TREASURY_WALLET, placed in the first tx.
 *
 * @param {Array<{address: string, amount: number}>} recipients
 * @param {string} sender - payer / source public key (base58)
 * @returns {Object} unsigned base64 transactions for the sender to sign & submit
 */
export async function batchSendSOL(recipients, sender) {
  if (!sender) throw new Error('sender (payer public key) is required');
  if (!config.TREASURY_WALLET) {
    throw new Error('TREASURY_WALLET is not configured');
  }

  const connection = getConnection();
  const senderPubkey = new PublicKey(sender);
  const feeRecipient = new PublicKey(config.TREASURY_WALLET);

  // Recipient transfers — funded by the agent, not the treasury.
  const recipientIxs = recipients.map((r) =>
    SystemProgram.transfer({
      fromPubkey: senderPubkey,
      toPubkey: new PublicKey(r.address),
      lamports: Math.floor(r.amount * 1e9),
    })
  );

  // 0.3% Spraay protocol fee on the total batch amount.
  const totalLamports = recipients.reduce(
    (sum, r) => sum + Math.floor(r.amount * 1e9),
    0
  );
  const feeLamports = Math.floor((totalLamports * FEE_BPS) / 10000);
  const feeIx =
    feeLamports > 0
      ? SystemProgram.transfer({
          fromPubkey: senderPubkey,
          toPubkey: feeRecipient,
          lamports: feeLamports,
        })
      : null;

  // Fee instruction rides first so it shares the per-tx cap with the recipients.
  const allIxs = feeIx ? [feeIx, ...recipientIxs] : recipientIxs;

  const MAX_PER_TX = config.MAX_INSTRUCTIONS_PER_TX;
  const chunks = [];
  for (let i = 0; i < allIxs.length; i += MAX_PER_TX) {
    chunks.push(allIxs.slice(i, i + MAX_PER_TX));
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  // Build UNSIGNED transactions — serialize without requiring signatures.
  const transactions = chunks.map((chunk) => {
    const tx = new Transaction();
    chunk.forEach((ix) => tx.add(ix));
    tx.recentBlockhash = blockhash;
    tx.feePayer = senderPubkey;
    return tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString('base64');
  });

  return {
    success: true,
    custodial: false,
    sender,
    recipients: recipients.length,
    feeBps: FEE_BPS,
    feeLamports,
    feeSol: feeLamports / 1e9,
    transactionCount: transactions.length,
    transactions, // base64 unsigned txs — sign with the sender wallet and submit
    blockhash,
    lastValidBlockHeight,
    note: 'Sign each transaction with the sender wallet and submit. The gateway does not custody funds or sign on your behalf.',
  };
}
