export function logRequest(req, extra = '') {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.originalUrl || req.url;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  console.log(`[${timestamp}] ${method} ${path} — ${ip} ${extra}`);
}
