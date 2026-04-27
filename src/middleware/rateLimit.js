const buckets = new Map();

const DEFAULT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const DEFAULT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 10);

function pruneOldEntries(bucket, now, windowMs) {
  while (bucket.length > 0 && now - bucket[0] > windowMs) {
    bucket.shift();
  }
}

function getClientIdentifier(req) {
  const apiKey = req.headers['x-api-key'];

  if (typeof apiKey === 'string' && apiKey.trim()) {
    return `api-key:${apiKey.trim()}`;
  }

  return `ip:${req.ip || 'unknown'}`;
}

function createRateLimitByApiKey(options = {}) {
  const windowMs = Number(options.windowMs || DEFAULT_WINDOW_MS);
  const maxRequests = Number(options.maxRequests || DEFAULT_MAX_REQUESTS);

  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error('RATE_LIMIT_WINDOW_MS invalido.');
  }

  if (!Number.isFinite(maxRequests) || maxRequests <= 0) {
    throw new Error('RATE_LIMIT_MAX_REQUESTS invalido.');
  }

  return function rateLimitByApiKey(req, res, next) {
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }

    const now = Date.now();
    const key = getClientIdentifier(req);
    const bucket = buckets.get(key) || [];

    pruneOldEntries(bucket, now, windowMs);

    if (bucket.length >= maxRequests) {
      const retryAfterSeconds = Math.ceil((windowMs - (now - bucket[0])) / 1000);

      res.setHeader('Retry-After', String(Math.max(1, retryAfterSeconds)));
      return res.status(429).json({
        error: true,
        message: 'Limite de requisicoes excedido. Tente novamente em instantes.',
      });
    }

    bucket.push(now);
    buckets.set(key, bucket);
    return next();
  };
}

function clearRateLimitBuckets() {
  buckets.clear();
}

module.exports = {
  createRateLimitByApiKey,
  clearRateLimitBuckets,
};
