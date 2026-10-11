const express = require('express');
const path = require('path');
const studentRoutes = require('./routes/student.routes');

const app = express();

// Middlewares: static files + JSON body parser for CSR fetch() requests
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routing
app.use('/', studentRoutes);

// Centralized Error Handling (returns JSON for API routes)
app.use((err, req, res, next) => {
  console.error('[Application Error]:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error.',
      errors: err.errors || [err.message || 'Internal Server Error.'],
    });
  }
  return res.status(500).send('Internal Server Error.');
});

module.exports = app;
