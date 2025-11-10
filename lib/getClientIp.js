// Minimal, robust client IP extraction used by route handlers.

function normalizeIp(ip) {
  if (!ip) return '';
  // strip IPv6-mapped IPv4 prefix and any port
  return ip.replace(/^::ffff:/, '').replace(/:\d+$/, '').trim();
}

module.exports = function getClientIp(req) {
  if (!req) return '';

  // Prefer X-Forwarded-For header (may contain comma-separated list)
  const xff = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-forwarded']);
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return normalizeIp(first);
  }

  // Express may expose req.ip (respects trust proxy setting)
  if (req.ip) return normalizeIp(req.ip);

  // Fallback to connection/socket remote address
  const conn = req.connection || req.socket || req;
  const addr = (conn && (conn.remoteAddress || conn.remoteaddr)) || '';
  return normalizeIp(addr);
};
