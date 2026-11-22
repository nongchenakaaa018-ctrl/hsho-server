'use strict';

const authService = require('../services/auth.service');
const { fail } = require('../utils/response');
const players = require('../services/player.service');

async function requireGame(req, res, next) {
  const token = authService.extractToken(req);
  const player = await authService.verifyToken(token);
  if (!player) return fail(res, 401, 'Invalid or expired session_token');
  req.player = player;
  req.token = token;
  return next();
}

function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey || req.query?.adminKey;
  if (adminKey !== require('../config').adminKey) return fail(res, 403, 'Forbidden');
  return next();
}

function isBanned(player) { return players.isBanned(player); }

module.exports = { requireGame, requireAdmin, isBanned };
