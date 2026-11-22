'use strict';

const express = require('express');
const router = express.Router();

const db = require('../db');
const config = require('../config');
const playerRepo = require('../repositories/player.repo');
const settingsRepo = require('../repositories/settings.repo');
const logRepo = require('../repositories/log.repo');
const players = require('../services/player.service');
const storeService = require('../services/store.service');
const { requireAdmin } = require('../middlewares/auth');
const { ok, fail } = require('../utils/response');
const { asyncHandler } = require('../utils/async');

router.get('/health', asyncHandler(async (req, res) => {
  return ok(res, {
    ok: db.isReady(),
    service: 'Home Sweet Home Online API',
    driver: db.getDriver(),
    database: config.mongo.dbName,
    players: await playerRepo.count(),
    time: new Date().toISOString(),
    version: '2.0.0',
  });
}));

router.get('/players', requireAdmin, asyncHandler(async (req, res) => {
  const list = (await playerRepo.all()).map((player) => ({
    steamId: player.steamId,
    displayName: player.displayName,
    coin: player.coin,
    amethyst: player.amethyst,
    amulet: player.amulet,
    lastOnline: player.lastOnline,
  }));
  return ok(res, { players: list });
}));

router.post('/admin/grant', requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const player = await playerRepo.find(players.parseSteamId(body));
  if (!player) return fail(res, 404, 'Player not found');

  for (const key of ['coin', 'amethyst', 'amulet']) {
    if (body[key] !== undefined) player[key] = Math.max(0, (Number(player[key]) || 0) + Number(body[key]));
  }
  if (body.itemId) players.grantItem(player, body.itemId, Number(body.quantity) || 1);
  await players.save(player);
  return ok(res, {
    steamId: player.steamId,
    coin: player.coin,
    amethyst: player.amethyst,
    amulet: player.amulet,
  });
}));

router.put('/admin/bundles', requireAdmin, asyncHandler(async (req, res) => {
  return ok(res, await storeService.setBundles(req.body?.bundles));
}));

router.post('/admin/bundles/reload', requireAdmin, asyncHandler(async (req, res) => {
  return ok(res, await storeService.reloadBundles());
}));

router.put('/admin/settings', requireAdmin, asyncHandler(async (req, res) => {
  return ok(res, await settingsRepo.set(req.body || {}));
}));

router.get('/admin/logs', requireAdmin, asyncHandler(async (req, res) => {
  return ok(res, { logs: await logRepo.recent(Number(req.query?.limit) || 50) });
}));

module.exports = router;
