'use strict';

function notFound(req, res) {
  console.warn(`[API] Unhandled request: ${req.method} ${req.originalUrl}`);
  return res.status(404).json({ status: 0, data: null, error: 'Not found' });
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[API] Error:', error);
  if (res.headersSent) return next(error);
  const status = error.statusCode || error.status || 500;
  return res.status(status).json({
    status: 0,
    data: null,
    error: error.message || 'Internal server error',
  });
}

module.exports = { notFound, errorHandler };
