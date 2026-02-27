import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

/**
 * Get or create Associated Token Account instruction for a recipient.
 * Returns { ata, instruction } where instruction is null if ATA already exists.
 */
export async function getOrCreateATA(connection, mint, owner, payer) {
  const ata = await getAssociatedTokenAddress(
    mint,
    owner,
    true, // allowOwnerOffCurve
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const account = await connection.getAccountInfo(ata);

  if (account) {
    return { ata, instruction: null };
  }

  const instruction = createAssociatedTokenAccountInstruction(
    payer,
    ata,
    owner,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return { ata, instruction };
}
