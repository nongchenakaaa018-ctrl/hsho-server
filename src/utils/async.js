'use strict';

// Express 4 does not forward rejected async handlers to error middleware.
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function read(router, path, handler, ...middlewares) {
  const wrapped = asyncHandler(handler);
  router.get(path, ...middlewares, wrapped);
  router.post(path, ...middlewares, wrapped);
}

module.exports = { asyncHandler, read };
