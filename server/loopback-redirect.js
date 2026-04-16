const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1"]);

const normalizeHostHeader = (hostHeader) => {
  const raw = String(hostHeader ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("[")) {
    const endBracket = raw.indexOf("]");
    if (endBracket !== -1) {
      return raw.slice(1, endBracket);
    }
  }
  const colonCount = (raw.match(/:/g) || []).length;
  if (colonCount > 1) {
    return raw;
  }
  const [hostname] = raw.split(":");
  return hostname;
};

const shouldRedirectLoopbackRequest = (req) => {
  const method = String(req?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  if (String(req?.headers?.upgrade ?? "").trim()) return false;
  const host = normalizeHostHeader(req?.headers?.host);
  return LOOPBACK_HOSTS.has(host);
};

const resolveLoopbackRedirectUrl = (req, options = {}) => {
  if (!shouldRedirectLoopbackRequest(req)) return null;
  const port = Number(options.port);
  if (!Number.isFinite(port) || port <= 0) return null;
  const protocol = options.useHttps ? "https" : "http";
  const rawUrl = typeof req?.url === "string" && req.url.trim() ? req.url : "/";
  return `${protocol}://localhost:${port}${rawUrl}`;
};

module.exports = {
  resolveLoopbackRedirectUrl,
};