'use strict';

const catalogRepo = require('../repositories/catalog.repo');
const playerRepo = require('../repositories/player.repo');
const logRepo = require('../repositories/log.repo');
const players = require('./player.service');

const RARITY_WEIGHTS = { 1: 70, 2: 20, 3: 7, 4: 2, 5: 1 };

function pickRarity() {
  const total = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return '1';
}

function formatImmortal(skin, includeStatus = true) {
  const result = {
    skin_shortcode: skin.skin_shortcode,
    activity: (skin.activity || []).map((act) => ({
      skin_activity: act.skin_activity,
      goal: act.goal ?? 0,
      skin_quest_status: act.skin_quest_status ?? 0,
    })),
  };
  if (includeStatus) result.isActive = skin.isActive !== false;
  return result;
}

async function immortalStatic() { return catalogRepo.template('immortal'); }

function immortalPlayer(player) {
  return (player.immortalData || []).map((skin) => formatImmortal(skin, true));
}

async function immortalMatch(playerId) {
  const player = await playerRepo.find(String(playerId));
  if (!player) return null;
  return [{
    player_id: player.steamId,
    immortal_data: (player.immortalData || []).map((skin) => formatImmortal(skin, false)),
  }];
}

async function pots(code) { return catalogRepo.pots(code); }

async function openLootBox(player, body = {}) {
  const code = body.loot_box_short_code;
  if (!code) return { error: { status: 400, payload: { status: 'error', message: 'loot_box_short_code is required' } } };

  const amount = Number(body.amount);
  if (!amount || amount < 1 || amount > 100) {
    return { error: { status: 400, payload: { status: 'error', message: 'amount must be between 1 and 100' } } };
  }

  const potData = await catalogRepo.pots(code);
  if (!potData) return { error: { status: 400, payload: { status: 'error', message: 'Invalid loot box type' } } };

  const items = potData.data?.items || [];
  if (items.length === 0) {
    return { error: { status: 500, payload: { status: 'error', message: 'Banner has no items configured' } } };
  }

  const lootdrops = [];
  for (let i = 0; i < amount; i += 1) {
    const rarity = pickRarity();
    const pool = items.filter((item) => String(item.rarity) === rarity);
    const source = pool.length ? pool : items;
    const item = source[Math.floor(Math.random() * source.length)];
    const isDup = Math.random() > 0.5;
    if (!isDup) players.grantItem(player, item.short_code, Number(item.amount) || 1);

    lootdrops.push({
      short_code: item.short_code,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      amount: 1,
      duplicate_exchange: item.duplicate_exchange || {
        enable: true, short_code: 'coin', amount: (Number(item.rarity) || 1) * 100, type: 'currency',
      },
      is_dup: isDup,
    });
  }
  await players.save(player);
  return { data: { loot_box_type_str: code, loot_box_amount: amount, lootdrops } };
}

function bonus(player) {
  return { bonusData: [], claimed: player.bonus?.claimed || {} };
}

function mailbox(player) {
  const mailboxItems = player.mailbox || [];
  return { next: {}, previous: {}, totalDocument: mailboxItems.length, mailbox: mailboxItems };
}

function gachaBanner() {
  return {
    banners: [
      { shortCode: 'Default_Gacha', title: 'Lucky Pot', pots: 'static/pots/greedy.json', isActive: true },
      { shortCode: 'Bullet_Gacha', title: 'Bullet Pot', pots: 'static/pots/bullet.json', isActive: true },
    ],
  };
}

function treasure(player) {
  return player.treasure || { level: 1, exp: 0, progress: 0 };
}

async function log(type, body, ip) {
  await logRepo.append(type, body, ip);
}

module.exports = {
  immortalStatic, immortalPlayer, immortalMatch, pots, openLootBox,
  bonus, mailbox, gachaBanner, treasure, log,
};
