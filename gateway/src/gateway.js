const express = require('express');
const axios = require('axios');

const app = express();
const gatewayPort = process.env.GATEWAY_PORT || 8080;
const backendUrl = `http://backend:${process.env.BACKEND_PORT}`

app.use(express.json());

async function proxyRequest(req, res, next) {
  const startTime = Date.now();
  const targetPath = req.url;
  const targetUrl = `${backendUrl}${targetPath}`;

  try {
    console.log(`[${req.method}] ${req.url} -> ${targetUrl}`);

    const headers = {};

    if (req.body && Object.keys(req.body).length > 0) {
      headers['Content-Type'] = req.headers['content-type'] || 'application/json';
    }

    headers['X-Forwarded-For'] = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    headers['X-Forwarded-Proto'] = req.protocol;
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers,
      timeout: 30000, // 30 second timeout
      validateStatus: () => true, // Don't throw on any status
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      maxBodyLength: 50 * 1024 * 1024,
    });

    const duration = Date.now() - startTime;
    console.log(`[${req.method}] ${req.url} <- ${response.status} (${duration}ms)`);

    res.status(response.status);

    const headersToForward = ['content-type', 'content-length'];
    headersToForward.forEach((header) => {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', {
      message: error.message,
      code: error.code,
      url: targetUrl,
      stack: error.stack,
    });

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`Connection refused to ${targetUrl}`);
        res.status(503).json({
          error: 'Backend service unavailable',
          message: 'The backend service is currently unavailable. Please try again later.',
        });
        return;
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.error(`Timeout connecting to ${targetUrl}`);
        res.status(504).json({
          error: 'Backend service timeout',
          message: 'The backend service did not respond in time. Please try again later.',
        });
        return;
      } else if (error.response) {
        res.status(error.response.status).json(error.response.data);
        return;
      }
    }

    if (!res.headersSent) {
      res.status(502).json({ error: 'bad gateway' });
    } else {
      next(error);
    }
  }
}

app.all('/api/*', proxyRequest);

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(gatewayPort, () => {
  console.log(`Gateway listening on port ${gatewayPort}, forwarding to ${backendUrl}`);
});
