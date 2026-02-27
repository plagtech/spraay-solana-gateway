# 💧 Spraay Solana Gateway

**x402-powered batch payment infrastructure for AI agents on Solana.**

Any AI agent can batch send SOL, USDC, BONK, or any SPL token to 1,000+ wallets via the x402 payment protocol. No API keys. No accounts. Pay per request.

## 🏗️ Architecture

```
AI Agent (any framework)
    │
    ├── HTTP Request
    │
    ▼
┌──────────────────────────────────────────┐
│   Spraay Solana Gateway                  │
│   gateway-solana.spraay.app              │
│                                          │
│   @x402/express + @x402/svm             │
│   ┌─────────────┐  ┌──────────────┐     │
│   │ x402 Payment│  │ Solana Batch │     │
│   │ Middleware   │  │ Engine       │     │
│   └──────┬──────┘  └──────┬───────┘     │
│          │                │              │
│          ▼                ▼              │
│   USDC payment     Execute batch        │
│   verified via     SOL/SPL transfers    │
│   facilitator                           │
└──────────────────────────────────────────┘
    │
    ▼
Solana Network
```

## 📡 Endpoints

| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/solana/batch-send-sol` | POST | $0.01 | Batch send SOL to multiple wallets |
| `/solana/batch-send-token` | POST | $0.01 | Batch send any SPL token |
| `/solana/quote` | GET | $0.001 | Get cost estimate |
| `/solana/status/:txid` | GET | $0.001 | Check transaction status |
| `/health` | GET | Free | Health check |
| `/.well-known/x402` | GET | Free | x402 discovery manifest |

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/plagtech/spraay-solana-gateway.git
cd spraay-solana-gateway
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your treasury wallet and private key
```

### 3. Run

```bash
npm run dev    # development (auto-reload)
npm start      # production
```

## 📖 API Usage

### Batch Send SOL

```bash
curl -X POST https://gateway-solana.spraay.app/solana/batch-send-sol \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <base64 payment proof>" \
  -d '{
    "recipients": [
      { "address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", "amount": 0.01 },
      { "address": "7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyLWP9SfKFJ", "amount": 0.02 }
    ]
  }'
```

### Batch Send SPL Token

```bash
curl -X POST https://gateway-solana.spraay.app/solana/batch-send-token \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <base64 payment proof>" \
  -d '{
    "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "recipients": [
      { "address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", "amount": 1000 },
      { "address": "7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyLWP9SfKFJ", "amount": 500 }
    ]
  }'
```

### Get Quote

```bash
curl "https://gateway-solana.spraay.app/solana/quote?recipients=100&token=BONK"
```

## 🔐 x402 Payment Flow

1. Agent sends request **without** payment header
2. Gateway returns `402 Payment Required` with Solana USDC payment instructions
3. Agent sends USDC on Solana to the treasury address
4. Agent retries request with payment proof in `X-PAYMENT` header
5. Gateway verifies payment via facilitator, executes batch transfer

**Supported facilitators:**
- Devnet: `https://x402.org/facilitator`
- Mainnet: `https://facilitator.payai.network` (PayAI — free tx fees)

## 🤖 MCP Server

The gateway includes an MCP server for AI agent framework integration:

```bash
# Install MCP SDK
npm install @modelcontextprotocol/sdk

# Run MCP server
node mcp/spraay-solana-mcp.js
```

**Tools available:**
- `spraay_solana_batch_send_sol` — Batch send SOL
- `spraay_solana_batch_send_token` — Batch send SPL tokens
- `spraay_solana_quote` — Cost estimation
- `spraay_solana_tx_status` — Transaction lookup

## 🌐 Deployment

### Railway

1. Create new service in Railway project
2. Connect GitHub repo: `plagtech/spraay-solana-gateway`
3. Set environment variables in Railway dashboard
4. Deploy → configure custom domain

### DNS (GoDaddy)

```
Type: CNAME
Name: gateway-solana
Value: <railway-app-url>.railway.app
TTL: 600
```

## 🔗 Spraay Ecosystem

| Service | URL |
|---------|-----|
| Spraay App | [spraay.app](https://spraay.app) |
| Base Gateway | [gateway.spraay.app](https://gateway.spraay.app) |
| Solana Gateway | [gateway-solana.spraay.app](https://gateway-solana.spraay.app) |
| GitHub | [github.com/plagtech](https://github.com/plagtech) |
| Twitter | [@Spraay_app](https://twitter.com/Spraay_app) |

## 📄 License

MIT
