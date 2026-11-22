'use strict';

const crypto = require('crypto');
const catalog = require('../repositories/catalog.repo');
const playerRepo = require('../repositories/player.repo');
const savedata = require('./savedata.service');
const config = require('../config');

const INVENTORY_CATEGORIES = [
  'characters', 'skins', 'perks', 'profiles', 'stickers', 'heads', 'backs',
  'costumes', 'rituals', 'cosmeticconsume', 'bundles', 'poses', 'effects',
];

const INVENTORY_DEFAULTS = {
  devAccount: false,
  characters: [], items: [], itemCounts: [], skins: [], perks: [], profiles: [],
  stickers: [], heads: [], backs: [], costumes: [], rituals: [], cosmeticconsume: [],
  bundles: [], poses: [], effects: [], lootBoxAmount: 50, bulletAmount: 50,
};

const ITEM_CATEGORY_RULES = [
  { matches: (id) => id.startsWith('Hunter_') || id.startsWith('Survivor_'), category: 'characters' },
  { matches: (id) => id.startsWith('Skin_'), category: 'skins' },
  { matches: (id) => id.startsWith('PP_'), category: 'perks' },
  { matches: (id) => id.startsWith('Profile_'), category: 'profiles' },
  { matches: (id) => id.startsWith('Sticker_'), category: 'stickers' },
  { matches: (id) => id.startsWith('Head_'), category: 'heads' },
  { matches: (id) => id.startsWith('Back_'), category: 'backs' },
  { matches: (id) => id.startsWith('Pose_'), category: 'poses' },
  { matches: (id) => id.startsWith('Bundle_'), category: 'bundles' },
  { matches: (id) => id.startsWith('FX_Warden_Transform_'), category: 'effects' },
  {
    matches: (id) => id.startsWith('Item_Ritual') || id.startsWith('Ritual_') || id.startsWith('Item_Sacrifice'),
    category: 'rituals',
  },
  {
    matches: (id) =>
      id.startsWith('Item_') || id.startsWith('HolyRice_') || id.startsWith('HolyWater_') ||
      id.startsWith('Holywater_') || id.startsWith('EnergyDrink_') || id.startsWith('SacredThread_') ||
      id.startsWith('Syringe_') || id.startsWith('Error_'),
    category: 'cosmeticconsume',
  },
];

const COSTUME_KEYWORDS = [
  '_Mask_', '_Puppet_', '_Scissors_', '_Cutter_', '_Armband_', '_Anklets_', '_Earring_',
  '_Earing_', '_Collar_', '_Belt_', '_Bracelet_', '_Necklace_', '_Gaiters_', '_KeyChain_',
  '_Chain_', '_Hook_', '_Katana_', '_Rapier_', '_Knife_', '_Pet_', '_Rabbit_', '_Sheep_',
  '_Deer_', '_Bag_', '_Keyboard_', '_KeyBoard_', '_Mic_',
];

function now() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function parseSteamId(body = {}) {
  const explicit = String(body.steamId || body.extId || body.userId || body.Player?.[0]?.playerId || '').trim();
  if (/^\d{10,20}$/.test(explicit)) return explicit;

  const ticket = String(body.ticket || '');
  if (/^[0-9a-f]+$/i.test(ticket) && ticket.length >= 20) {
    const buffer = Buffer.from(ticket, 'hex');
    for (let i = 0; i < buffer.length - 8; i += 1) {
      try {
        const id = buffer.readBigUInt64LE(i).toString();
        if (id.length === 17 && id.startsWith('765')) return id;
      } catch (_) { /* keep scanning */ }
    }
  }

  const name = String(body.displayName || body.username || 'Player').trim().toLowerCase();
  const digits = crypto.createHash('sha1').update(name).digest('hex').replace(/[^0-9]/g, '');
  return `765${digits.slice(0, 14).padEnd(14, '0')}`;
}

async function createDefault(steamId, displayName) {
  const template = await catalog.template('auth');
  const base = template?.data?.player || {};
  const name = displayName || `Player_${steamId.slice(-6)}`;

  return {
    steamId,
    displayName: name,
    coin: 250000,
    amethyst: 5000,
    amulet: 5000,
    devAccount: false,
    inventory: {
      ...clone(INVENTORY_DEFAULTS),
      characters: ['Hunter_Pray', 'Survivor_Tim'],
      skins: ['Skin_Nymph_D_Default', 'Skin_Tim_D_Default'],
      profiles: ['Profile_Default'],
      items: ['Default_Gacha', 'Bullet_Gacha'],
      itemCounts: [50, 50],
    },
    characterSlot: base.characterSlot || {},
    stickerSlot: base.stickerSlot || { stickerpreset: 0, stickerSet: [] },
    playerStat: base.playerStat || {},
    playerRecord: base.playerRecord || {},
    playerRecordHunter: base.playerRecordHunter || {},
    playerRecordSurvivor: base.playerRecordSurvivor || {},
    rankData: base.rankData || {},
    returnPlayerStatus: base.returnPlayerStatus || {},
    firstPayReward: base.firstPayReward ?? false,
    isNewPlayer: base.isNewPlayer ?? true,
    curseRelic: [],
    immortalData: [],
    profile: { display: 'Profile_Default', displayName: name, lastNameUpdate: now(), updatedAt: now() },
    banStatus: { permanentBanned: false, bannedUntil: null, banMessageCode: 1, reason: '', updatedAt: now() },
    isOnline: true,
    lastOnline: now(),
    gameplay: { status: 'offline', matchId: null, lastResult: null, authenAt: null },
    mailbox: [],
    treasure: { level: 1, exp: 0, progress: 0 },
    bonus: { claimed: {} },
    purchaseCounts: {},
    purchaseLog: [],
    lastSavedAt: null,
    updatedAt: now(),
  };
}

async function getOrCreate(steamId, displayName) {
  let player = await playerRepo.find(steamId);
  if (!player) {
    player = await createDefault(steamId, displayName);
    await playerRepo.upsert(player);
  }
  if (await savedata.ensureDefaults(player)) await playerRepo.upsert(player);
  return player;
}

function save(player) {
  player.updatedAt = now();
  return playerRepo.upsert(player);
}

function isBanned(player) {
  const ban = player?.banStatus || {};
  return Boolean(ban.permanentBanned) || (ban.bannedUntil && new Date(ban.bannedUntil) > new Date());
}

function banStatus(player) {
  const ban = player?.banStatus || {};
  return {
    permanentBanned: Boolean(ban.permanentBanned),
    bannedUntil: ban.bannedUntil || null,
    banMessageCode: ban.banMessageCode || 1,
    reason: ban.reason || '',
    updatedAt: ban.updatedAt || null,
  };
}

function legacyInventory(inventory) {
  const result = {};
  for (const category of INVENTORY_CATEGORIES) {
    for (const code of inventory?.[category] || []) {
      if (code && code !== 'None') result[code] = 1;
    }
  }
  (inventory?.items || []).forEach((code, index) => {
    if (code && code !== 'None') result[code] = inventory.itemCounts?.[index] || 1;
  });
  return { inventory: result };
}

function inventoryState(player) {
  return {
    ...clone(INVENTORY_DEFAULTS),
    ...(player.inventory || {}),
    coin: player.coin || 0,
    amethyst: player.amethyst || 0,
    amulet: player.amulet || 0,
  };
}

function resolveInventoryCategory(itemId) {
  const directRule = ITEM_CATEGORY_RULES.find((rule) => rule.matches(itemId));
  if (directRule) return directRule.category;
  if (COSTUME_KEYWORDS.some((keyword) => itemId.includes(keyword))) return 'costumes';
  return 'items';
}

function grantItem(player, itemId, quantity = 1) {
  if (!itemId || itemId === 'None') return false;
  const inventory = player.inventory;
  for (const key of Object.keys(INVENTORY_DEFAULTS)) {
    if (Array.isArray(INVENTORY_DEFAULTS[key]) && !Array.isArray(inventory[key])) inventory[key] = [];
  }
  const category = resolveInventoryCategory(itemId);
  if (category === 'items') {
    const index = inventory.items.indexOf(itemId);
    if (index >= 0) inventory.itemCounts[index] = (inventory.itemCounts[index] || 0) + Number(quantity || 1);
    else { inventory.items.push(itemId); inventory.itemCounts.push(Number(quantity || 1)); }
  } else if (!inventory[category].includes(itemId)) {
    inventory[category].push(itemId);
  }
  return true;
}

function removeItem(player, itemId) {
  const inventory = player.inventory;
  let removed = false;
  for (const category of INVENTORY_CATEGORIES) {
    const index = inventory[category]?.indexOf(itemId);
    if (index >= 0) { inventory[category].splice(index, 1); removed = true; }
  }
  const itemIndex = inventory.items?.indexOf(itemId) ?? -1;
  if (itemIndex >= 0) {
    inventory.items.splice(itemIndex, 1);
    inventory.itemCounts.splice(itemIndex, 1);
    removed = true;
  }
  return removed;
}

function characterSlotData(player) {
  const slot = player.characterSlot || {};
  const owned = player.inventory?.characters || [];
  const sanitize = (slots = []) =>
    slots.filter((entry) => entry.character === 'None' || owned.includes(entry.character));
  return {
    hunterSlot: sanitize(slot.hunterSlot),
    survivorSlot: sanitize(slot.survivorSlot),
    characterhunteritem: owned.includes(slot.characterhunteritem) ? slot.characterhunteritem : 'Hunter_Belle',
    characteritem: owned.includes(slot.characteritem) ? slot.characteritem : 'Survivor_Tim',
  };
}

async function authResponse(player, token) {
  const template = await catalog.template('auth');
  const response = clone(template || { status: 1, data: {} });
  response.status = 1;
  response.error = null;
  response.data = response.data || {};
  response.data.session_token = token;
  if (!response.data.player || typeof response.data.player !== 'object') response.data.player = {};
  Object.assign(response.data.player, clone(player));
  Object.assign(response.data.player, {
    session_token: token,
    _id: player.steamId,
    isOnline: true,
    lastOnline: now(),
    coin: player.coin,
    amethyst: player.amethyst,
    amulet: player.amulet,
    inventory: legacyInventory(player.inventory),
    curseRelic: player.curseRelic || [],
    profile: { ...(player.profile || {}), displayName: player.displayName, updatedAt: now() },
  });
  if (response.data.player.auth?.[0]) {
    response.data.player.auth[0].extId = player.steamId;
    response.data.player.auth[0].authAt = now();
  }
  return response;
}

module.exports = {
  now, clone, parseSteamId, createDefault, getOrCreate, save, isBanned, banStatus,
  legacyInventory, inventoryState, resolveInventoryCategory, grantItem, removeItem,
  characterSlotData, authResponse, INVENTORY_CATEGORIES, INVENTORY_DEFAULTS,
};
