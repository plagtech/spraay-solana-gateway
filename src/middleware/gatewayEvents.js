// ═══════════════════════════════════════════════════════════════
// 💧 Spraay Solana Gateway — event logging middleware
// ═══════════════════════════════════════════════════════════════
//
// Writes scan / intent / payment events into the SHARED `gateway_events`
// table (same table the main gateway uses), so Solana activity shows up on
// live.spraay.app. Purely an observer — it attaches a res.on('finish') hook
// and never touches the request/response or the send flow.
//
// This service is NON-CUSTODIAL: the batch transfer is returned unsigned for
// the agent to sign + submit, so the gateway never sees the batch signature.
// The settlement we CAN see and log is the x402 USDC micropayment — surfaced
// by @x402/express v2 in the PAYMENT-RESPONSE receipt header, exactly like the
// main gateway. That receipt's `transaction` is the tx_hash we record.
//
// Requires two env vars (set them in Railway):
//   SUPABASE_URL                = https://<project-ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   = <service-role key>   (NOT the anon key)
// If either is missing, the middleware quietly no-ops (service keeps running).
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

if (!supabase) {
  console.warn(
    '[gateway-events] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — event logging disabled.'
  );
}

// ── x402 v2 settlement receipt ──
// v2 (Dec 2025) dropped the X- prefix: X-PAYMENT-RESPONSE → PAYMENT-RESPONSE.
// The value is base64-encoded JSON; present on a successful 200 and on some
// failed 402s, so always check `.success`.
function decodeSettlement(res) {
  const h = res.getHeader('payment-response') ?? res.getHeader('x-payment-response');
  const raw = Array.isArray(h) ? h[0] : h;
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

// True if the request carried an x402 payment proof (v2 header, v1 fallback).
function hasPaymentHeader(req) {
  return Boolean(req.headers['payment-signature']) || Boolean(req.headers['x-payment']);
}

function classifyEvent(req, res, settlement) {
  const path = req.path;

  // Discovery hits are scans.
  if (path.startsWith('/.well-known/x402') || path.startsWith('/x402-resources')) {
    return 'scan';
  }

  // Authoritative: a receipt confirming success = a real (settled) payment.
  if (settlement?.success === true) return 'payment';

  // A 402 (incl. a failed receipt) is an unconverted intent.
  if (res.statusCode === 402) return 'intent';

  // Fallback: payment proof present + 2xx, and the receipt didn't say failed.
  if (
    hasPaymentHeader(req) &&
    res.statusCode >= 200 &&
    res.statusCode < 300 &&
    settlement?.success !== false
  ) {
    return 'payment';
  }

  return null;
}

function inferCategory(path) {
  const p = path.toLowerCase();
  if (p.includes('/batch')) return 'batch_payment';
  if (p.includes('/quote')) return 'quote';
  if (p.includes('/status')) return 'status';
  return 'solana_payment';
}

function inferEndpointName(path) {
  const parts = path.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || path;
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferScanner(userAgent) {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes('bazaar')) return 'bazaar';
  if (ua.includes('x402scan')) return 'x402scan';
  if (ua.includes('x402-healthbot')) return 'decixa';
  if (ua.includes('x402-network-mapper') || ua.includes('smartflowproai')) return 'smartflowproai';
  if (ua.includes('coinbase')) return 'coinbase';
  if (ua === 'node' || ua.startsWith('node/') || ua.startsWith('node ')) return 'node_default';
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) return 'generic_crawler';
  if (ua.includes('solana') || ua.includes('phantom') || ua.includes('jupiter')) return 'solana_agent';
  return null;
}

// Solana payer: prefer the verified payer from the x402 receipt, else the
// `sender` (agent payer pubkey) the batch endpoints already require in the body.
function extractPayer(req, settlement) {
  if (settlement?.payer) return settlement.payer;
  const body = req.body || {};
  const addr = body.sender || body.from || body.payer || body.address;
  return typeof addr === 'string' && addr.length > 0 ? addr : null;
}

function extractBatchSize(req) {
  const body = req.body;
  if (!body) return null;
  const recipients = body.recipients;
  if (Array.isArray(recipients) && recipients.length > 0) return recipients.length;
  return null;
}

function extractSourceIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0].split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) return realIp;
  return req.ip || null;
}

export function gatewayEvents(req, res, next) {
  if (!supabase) {
    next();
    return;
  }

  const client = supabase;
  const startTime = Date.now();
  const paymentAttempted = hasPaymentHeader(req);

  res.on('finish', () => {
    try {
      const settlement = decodeSettlement(res);
      const eventType = classifyEvent(req, res, settlement);
      if (!eventType) return;

      const userAgent = req.headers['user-agent'];
      const row = {
        event_type: eventType,
        path: req.path,
        method: req.method,
        http_status: res.statusCode,
        category: inferCategory(req.path),
        chain: 'solana', // this is the dedicated Solana gateway
        endpoint_name: inferEndpointName(req.path),
        payer_address: extractPayer(req, settlement),
        batch_size: extractBatchSize(req),
        // The x402 USDC settlement signature from the v2 receipt. The batch
        // transfer signature is never seen here (non-custodial), by design.
        tx_hash: settlement?.transaction ?? null,
        scanner_source: inferScanner(typeof userAgent === 'string' ? userAgent : undefined),
        user_agent: typeof userAgent === 'string' ? userAgent.slice(0, 200) : null,
        duration_ms: Date.now() - startTime,
        source_ip: extractSourceIp(req),
        payment_attempted: paymentAttempted,
      };

      client
        .from('gateway_events')
        .insert(row)
        .then(({ error }) => {
          if (error) console.error('[gateway-events] insert failed:', error.message);
        });
    } catch (err) {
      console.error('[gateway-events] middleware error:', err);
    }
  });

  next();
}
