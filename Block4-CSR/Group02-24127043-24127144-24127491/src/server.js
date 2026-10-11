const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`[CSR Server] Running at http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('[CSR Server] Gracefully stopped');
    process.exit(0);
  });
});
