const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    ['/chat', '/auth', '/model_providers', '/settings'],
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      ws: true,
      onProxyReq: function(proxyReq, req, res) {
        // Log the request for debugging
        console.log('Proxying request:', req.method, req.url);
      },
      onError: function(err, req, res) {
        console.error('Proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'text/plain',
        });
        res.end('Proxy error: ' + err.message);
      }
    })
  );
}; 