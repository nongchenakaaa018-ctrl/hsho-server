'use strict';

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.status(status);
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  return res.send(payload);
}

function ok(res, data, status = 200) {
  return send(res, status, { status: 1, data: data ?? {}, error: null });
}

function fail(res, status, error, data = null) {
  return send(res, status, { status: 0, data, error });
}

module.exports = { send, ok, fail };
