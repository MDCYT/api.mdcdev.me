const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

function appendForwardedFor(existingForwardedFor, clientIp) {
  if (!clientIp) {
    return existingForwardedFor;
  }

  return existingForwardedFor
    ? `${existingForwardedFor}, ${clientIp}`
    : clientIp;
}

function rewriteLocationHeader(location, targetOrigin, requestOrigin) {
  if (!location || !location.startsWith(targetOrigin)) {
    return location;
  }

  return `${requestOrigin}${location.slice(targetOrigin.length)}`;
}

function createReverseProxy({ targetOrigin, timeoutMs = 30000 }) {
  const normalizedTargetOrigin = targetOrigin.replace(/\/+$/, '');
  const transport = normalizedTargetOrigin.startsWith('https://') ? https : http;

  return (req, res) => {
    const upstreamUrl = new URL(req.originalUrl, `${normalizedTargetOrigin}/`);
    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    const headers = { ...req.headers };

    delete headers.host;
    delete headers.connection;

    headers['x-forwarded-host'] = req.get('host');
    headers['x-forwarded-proto'] = req.protocol;
    headers['x-forwarded-for'] = appendForwardedFor(req.headers['x-forwarded-for'], req.ip);

    const proxyReq = transport.request(
      upstreamUrl,
      {
        method: req.method,
        headers,
        timeout: timeoutMs,
      },
      (proxyRes) => {
        const responseHeaders = { ...proxyRes.headers };

        if (responseHeaders.location) {
          responseHeaders.location = rewriteLocationHeader(
            responseHeaders.location,
            normalizedTargetOrigin,
            requestOrigin
          );
        }

        res.writeHead(proxyRes.statusCode || 502, responseHeaders);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('timeout', () => {
      proxyReq.destroy(new Error('Upstream timeout'));
    });

    proxyReq.on('error', (error) => {
      if (res.headersSent) {
        res.end();
        return;
      }

      res.status(502).json({
        error: 'bad_gateway',
        message: 'No se pudo contactar al upstream de PeruServer.',
        details: error.message,
      });
    });

    req.pipe(proxyReq);
  };
}

module.exports = {
  createReverseProxy,
};
