import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { getConnection } from './connection.js';
import config from '../config.js';

/**
 * Batch send SOL to multiple recipients.
 * Auto-chunks into multiple transactions (max ~14 transfers per tx).
 *
 * @param {Array<{address: string, amount: number}>} recipients
 * @returns {Object} { success, recipients, transactions, signatures, explorer }
 */
export async function batchSendSOL(recipients) {
  const connection = getConnection();
  const serverKeypair = Keypair.fromSecretKey(
    bs58.decode(config.TREASURY_PRIVATE_KEY)
  );

  // Build transfer instructions
  const instructions = recipients.map(r =>
    SystemProgram.transfer({
      fromPubkey: serverKeypair.publicKey,
      toPubkey: new PublicKey(r.address),
      lamports: Math.floor(r.amount * 1e9), // SOL → lamports
    })
  );

  // Chunk into transactions
  const MAX_PER_TX = config.MAX_INSTRUCTIONS_PER_TX;
  const chunks = [];
  for (let i = 0; i < instructions.length; i += MAX_PER_TX) {
    chunks.push(instructions.slice(i, i + MAX_PER_TX));
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  // Sign and send all chunks
  const signatures = [];
  for (const chunk of chunks) {
    const tx = new Transaction();
    chunk.forEach(ix => tx.add(ix));
    tx.recentBlockhash = blockhash;
    tx.feePayer = serverKeypair.publicKey;
    tx.sign(serverKeypair);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    signatures.push(sig);
  }

  // Confirm all in parallel
  await Promise.all(
    signatures.map(sig =>
      connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed'
      )
    )
  );

  const clusterParam = config.NETWORK === 'devnet' ? '?cluster=devnet' : '';

  return {
    success: true,
    recipients: recipients.length,
    transactions: signatures.length,
    signatures,
    explorer: signatures.map(
      s => `https://explorer.solana.com/tx/${s}${clusterParam}`
    ),
  };
}
