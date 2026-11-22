'use strict';

const express = require('express');
const router = express.Router();

const extras = require('../services/extras.service');
const players = require('../services/player.service');
const playerRepo = require('../repositories/player.repo');
const { requireGame } = require('../middlewares/auth');
const { ok, fail } = require('../utils/response');
const { asyncHandler, read } = require('../utils/async');

read(router, '/live/immortal/get', async (req, res) => {
  return res.status(200).json(await extras.immortalStatic());
});

router.post('/live/immortal/player/get', requireGame, asyncHandler(async (req, res) => {
  return res.status(200).json({ data: extras.immortalPlayer(req.player), error: null });
}));

router.post('/live/immortal/player/getmatch', asyncHandler(async (req, res) => {
  const playerId = req.body?.player_id || req.body?.playerId || req.query?.player_id;
  if (!playerId) return res.status(400).json({ data: [], error: 'Player ID is required' });
  const data = await extras.immortalMatch(playerId);
  if (!data) return res.status(404).json({ data: [], error: 'Player not found' });
  return res.status(200).json({ data, error: null });
}));

read(router, '/live/lootboxgo/api/items', async (req, res) => {
  const code = req.query?.loot_box_short_code || req.body?.loot_box_short_code;
  const data = await extras.pots(code);
  if (!data) return res.status(404).json({ error: 'Loot box not found' });
  return res.status(200).json(data);
});

router.post('/live/lootboxgo/api/open', requireGame, asyncHandler(async (req, res) => {
  const result = await extras.openLootBox(req.player, req.body || {});
  if (result.error) return res.status(result.error.status).json(result.error.payload);
  return res.status(200).json({ status: 'success', data: result.data });
}));

read(router, '/live/bonus/api/get_bonus_data', async (req, res) => {
  return ok(res, extras.bonus(req.player));
}, requireGame);

read(router, '/live/mailbox/get', async (req, res) => {
  return ok(res, extras.mailbox(req.player));
}, requireGame);

read(router, '/live/gacha/static/api/banner', async (req, res) => {
  return ok(res, extras.gachaBanner());
});

read(router, '/live/treasure/api/progress/get', async (req, res) => {
  return ok(res, extras.treasure(req.player));
}, requireGame);

// ------------------------------------------------------------------- logapi
const LOG_TYPES = {
  penalty: async (req) => {
    const steamId = players.parseSteamId(req.body || {});
    const player = await playerRepo.find(steamId);
    return { penalized: players.isBanned(player || {}), ...players.banStatus(player || {}) };
  },
  matchlog: async () => ({ accepted: true }),
  ingame: async () => ({ accepted: true }),
  errorlog: async () => ({ accepted: true }),
};

for (const [type, handler] of Object.entries(LOG_TYPES)) {
  router.post(`/logapi/v1/${type === 'penalty' ? 'check' : 'add'}/${type}`, asyncHandler(async (req, res) => {
    await extras.log(type, req.body || {}, req.ip || '');
    return ok(res, await handler(req));
  }));
}

// serverdetect is a check endpoint, not add.
router.post('/logapi/v1/check/serverdetect', asyncHandler(async (req, res) => {
  await extras.log('serverdetect', req.body || {}, req.ip || '');
  return ok(res, { accepted: true });
}));

module.exports = router;
