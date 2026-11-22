'use strict';

const express = require('express');
const config = require('./config');
const mountRoutes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error');

module.exports = function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true, limit: '4mb' }));

  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', config.corsOrigin);
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  });

  mountRoutes(app);

  // Browsers ask for this automatically — silently ignore it.
  app.get('/favicon.ico', (req, res) => res.status(204).end());

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
