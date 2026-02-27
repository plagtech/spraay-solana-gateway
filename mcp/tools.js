export const GATEWAY_URL = 'https://gateway-solana.spraay.app';

export const tools = [
  {
    name: 'spraay_solana_batch_send_sol',
    description:
      'Send SOL to multiple Solana wallets in a single batch. Supports up to 1000 recipients. ' +
      'Auto-chunks into multiple transactions as needed. Costs $0.01 USDC via x402 protocol on Solana.',
    inputSchema: {
      type: 'object',
      properties: {
        recipients: {
          type: 'array',
          description: 'Array of recipients with Solana address and SOL amount',
          items: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana wallet address (base58)' },
              amount: { type: 'number', description: 'Amount of SOL to send' },
            },
            required: ['address', 'amount'],
          },
        },
      },
      required: ['recipients'],
    },
  },
  {
    name: 'spraay_solana_batch_send_token',
    description:
      'Send any SPL token (USDC, BONK, WIF, JUP, etc.) to multiple Solana wallets in a single batch. ' +
      'Provide the token mint address. Auto-creates token accounts for recipients. ' +
      'Costs $0.01 USDC via x402 protocol on Solana.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'SPL token mint address (base58)' },
        recipients: {
          type: 'array',
          description: 'Array of recipients with Solana address and token amount',
          items: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Solana wallet address (base58)' },
              amount: { type: 'number', description: 'Amount of tokens to send (human-readable units)' },
            },
            required: ['address', 'amount'],
          },
        },
      },
      required: ['mint', 'recipients'],
    },
  },
  {
    name: 'spraay_solana_quote',
    description:
      'Get a cost estimate for a batch send on Solana. Returns estimated network fees, ' +
      'number of transactions needed, and timing. Costs $0.001 USDC via x402.',
    inputSchema: {
      type: 'object',
      properties: {
        recipients: { type: 'number', description: 'Number of recipients' },
        token: { type: 'string', description: 'Token symbol (SOL, USDC, BONK, etc.). Defaults to SOL.' },
      },
      required: ['recipients'],
    },
  },
  {
    name: 'spraay_solana_tx_status',
    description:
      'Check the status of a Solana transaction by its signature. ' +
      'Returns confirmation status, block time, and explorer link. Costs $0.001 USDC via x402.',
    inputSchema: {
      type: 'object',
      properties: {
        txid: { type: 'string', description: 'Solana transaction signature' },
      },
      required: ['txid'],
    },
  },
];
