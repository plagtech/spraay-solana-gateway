import {
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getConnection } from './connection.js';
import { getOrCreateATA } from './ataHelper.js';
import config from '../config.js';

// 0.3% from your existing GATEWAY_FEE_PERCENT, expressed in basis points.
const FEE_BPS = Math.round((config.GATEWAY_FEE_PERCENT ?? 0.3) * 100);

/**
 * Build a NON-CUSTODIAL batch SPL-token transfer.
 *
 * The agent (`sender`) owns the source token account, pays for any ATA
 * creation, and is the fee payer. Transactions are returned UNSIGNED and
 * serialized for the agent's wallet to sign and submit. The gateway holds
 * no keys and moves none of its own funds.
 *
 * A 0.3% Spraay protocol fee on the total token amount is added as a single
 * transfer from the sender's ATA to TREASURY_WALLET's ATA.
 *
 * @param {string} mintAddress
 * @param {Array<{address: string, amount: number}>} recipients
 * @param {string} sender - payer / source token-account owner (base58)
 * @returns {Object} unsigned base64 transactions for the sender to sign & submit
 */
export async function batchSendToken(mintAddress, recipients, sender) {
  if (!sender) throw new Error('sender (payer public key) is required');
  if (!config.TREASURY_WALLET) {
    throw new Error('TREASURY_WALLET is not configured');
  }

  const connection = getConnection();
  const senderPubkey = new PublicKey(sender);
  const feeRecipient = new PublicKey(config.TREASURY_WALLET);
  const mint = new PublicKey(mintAddress);

  const mintInfo = await getMint(connection, mint);
  const decimals = mintInfo.decimals;

  const senderATA = await getAssociatedTokenAddress(mint, senderPubkey);

  let atasCreated = 0;

  // Recipient instruction groups: optional ATA create (payer = sender) + transfer.
  const recipientInstructions = [];
  for (const r of recipients) {
    const recipientPubkey = new PublicKey(r.address);
    const { ata, instruction: ataInstruction } = await getOrCreateATA(
      connection,
      mint,
      recipientPubkey,
      senderPubkey // payer is the agent, not the treasury
    );

    const ixGroup = [];
    if (ataInstruction) {
      ixGroup.push(ataInstruction);
      atasCreated++;
    }

    const rawAmount = BigInt(Math.floor(r.amount * Math.pow(10, decimals)));
    ixGroup.push(
      createTransferInstruction(
        senderATA,
        ata,
        senderPubkey,
        rawAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    recipientInstructions.push(ixGroup);
  }

  // 0.3% Spraay protocol fee on the total token amount, sent to the fee ATA.
  const totalRaw = recipients.reduce(
    (sum, r) => sum + BigInt(Math.floor(r.amount * Math.pow(10, decimals))),
    0n
  );
  const feeRaw = (totalRaw * BigInt(FEE_BPS)) / 10000n;

  const feeGroup = [];
  if (feeRaw > 0n) {
    const { ata: feeATA, instruction: feeAtaIx } = await getOrCreateATA(
      connection,
      mint,
      feeRecipient,
      senderPubkey
    );
    if (feeAtaIx) {
      feeGroup.push(feeAtaIx);
      atasCreated++;
    }
    feeGroup.push(
      createTransferInstruction(
        senderATA,
        feeATA,
        senderPubkey,
        feeRaw,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  // Fee group first, then recipient groups.
  const allGroups =
    feeGroup.length > 0 ? [feeGroup, ...recipientInstructions] : recipientInstructions;

  // Dynamic chunking — keep each instruction group intact within one tx.
  const MAX_PER_TX = config.MAX_INSTRUCTIONS_PER_TX_TOKEN;
  const chunks = [];
  let currentChunk = [];
  let currentIxCount = 0;

  for (const ixGroup of allGroups) {
    if (currentIxCount + ixGroup.length > MAX_PER_TX && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentIxCount = 0;
    }
    currentChunk.push(...ixGroup);
    currentIxCount += ixGroup.length;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  // Build UNSIGNED transactions.
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
    token: mintAddress,
    decimals,
    sender,
    recipients: recipients.length,
    feeBps: FEE_BPS,
    feeRaw: feeRaw.toString(),
    feeAmount: Number(feeRaw) / Math.pow(10, decimals),
    atasCreated,
    transactionCount: transactions.length,
    transactions, // base64 unsigned txs — sign with the sender wallet and submit
    blockhash,
    lastValidBlockHeight,
    note: 'Sign each transaction with the sender wallet and submit. The gateway does not custody funds or sign on your behalf.',
  };
}
