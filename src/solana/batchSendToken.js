import {
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { getConnection } from './connection.js';
import { getOrCreateATA } from './ataHelper.js';
import config from '../config.js';

/**
 * Batch send any SPL token to multiple recipients.
 * Auto-creates ATAs as needed and chunks transactions.
 *
 * @param {string} mintAddress - SPL token mint address
 * @param {Array<{address: string, amount: number}>} recipients
 * @returns {Object} { success, token, recipients, transactions, signatures, explorer, atasCreated }
 */
export async function batchSendToken(mintAddress, recipients) {
  const connection = getConnection();
  const serverKeypair = Keypair.fromSecretKey(
    bs58.decode(config.TREASURY_PRIVATE_KEY)
  );
  const mint = new PublicKey(mintAddress);

  // Get token decimals from on-chain mint account
  const mintInfo = await getMint(connection, mint);
  const decimals = mintInfo.decimals;

  // Get server's token account
  const serverATA = await getAssociatedTokenAddress(
    mint,
    serverKeypair.publicKey
  );

  // Build instructions for each recipient
  // Each recipient may need 1 (transfer) or 2 (create ATA + transfer) instructions
  const recipientInstructions = [];
  let atasCreated = 0;

  for (const r of recipients) {
    const recipientPubkey = new PublicKey(r.address);
    const { ata, instruction: ataInstruction } = await getOrCreateATA(
      connection,
      mint,
      recipientPubkey,
      serverKeypair.publicKey
    );

    const ixGroup = [];
    if (ataInstruction) {
      ixGroup.push(ataInstruction);
      atasCreated++;
    }

    const rawAmount = BigInt(Math.floor(r.amount * Math.pow(10, decimals)));
    ixGroup.push(
      createTransferInstruction(
        serverATA,
        ata,
        serverKeypair.publicKey,
        rawAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    recipientInstructions.push(ixGroup);
  }

  // Dynamic chunking — SPL transfers with ATA creation are larger
  // ~7 per tx with ATA creation, ~10 per tx without
  const MAX_PER_TX = config.MAX_INSTRUCTIONS_PER_TX_TOKEN;
  const chunks = [];
  let currentChunk = [];
  let currentIxCount = 0;

  for (const ixGroup of recipientInstructions) {
    if (currentIxCount + ixGroup.length > MAX_PER_TX && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentIxCount = 0;
    }
    currentChunk.push(...ixGroup);
    currentIxCount += ixGroup.length;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
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
    token: mintAddress,
    decimals,
    recipients: recipients.length,
    transactions: signatures.length,
    signatures,
    atasCreated,
    explorer: signatures.map(
      s => `https://explorer.solana.com/tx/${s}${clusterParam}`
    ),
  };
}
