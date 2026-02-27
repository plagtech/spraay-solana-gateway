import dotenv from 'dotenv';
dotenv.config();

const NETWORK = process.env.NETWORK || 'devnet';

const config = {
  PORT: parseInt(process.env.PORT || '3000'),
  NETWORK,

  // Solana RPC
  RPC_URL: process.env.SOLANA_RPC_URL || (
    NETWORK === 'mainnet-beta'
      ? 'https://api.mainnet-beta.solana.com'
      : 'https://api.devnet.solana.com'
  ),

  // Treasury
  TREASURY_WALLET: process.env.TREASURY_WALLET,
  TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY,

  // Token mints
  USDC_MINT: NETWORK === 'mainnet-beta'
    ? (process.env.USDC_MINT_MAINNET || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    : (process.env.USDC_MINT_DEVNET || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),

  // Fees
  GATEWAY_FEE_PERCENT: parseFloat(process.env.GATEWAY_FEE_PERCENT || '0.3'),

  // x402
  FACILITATOR_URL: process.env.FACILITATOR_URL || 'https://x402.org/facilitator',

  // CAIP-2 network identifiers for x402
  // Solana devnet: solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
  // Solana mainnet: solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
  X402_NETWORK: NETWORK === 'mainnet-beta'
    ? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
    : 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',

  // Batch limits
  MAX_RECIPIENTS: 1000,
  MAX_INSTRUCTIONS_PER_TX: 14,          // SOL transfers
  MAX_INSTRUCTIONS_PER_TX_TOKEN: 7,     // SPL transfers (with ATA creation)
};

export default config;
