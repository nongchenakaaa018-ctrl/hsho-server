'use strict';

const staticJson = require('@utils/static-json.util');

// Object-shaped progression fields the client reads and writes.
const OBJECT_FIELDS = Object.freeze([
  'playerStat',
  'playerRecord',
  'playerRecordHunter',
  'playerRecordSurvivor',
  'rankData',
  'returnPlayerStatus',
]);
const BOOLEAN_FIELDS = new Set(['firstPayReward', 'isNewPlayer']);
const ARRAY_FIELDS = new Set(['curseRelic']);

// Every field returned to the game as SaveData.
const CLIENT_SAVE_FIELDS = Object.freeze([
  ...OBJECT_FIELDS,
  'curseRelic',
  'firstPayReward',
  'isNewPlayer',
]);

// Fields a modified client is allowed to write back. curseRelic (relic ownership),
// currencies, inventory, ban status and lastSavedAt are deliberately excluded.
const CLIENT_WRITABLE_FIELDS = Object.freeze([
  ...OBJECT_FIELDS,
  'firstPayReward',
  'isNewPlayer',
]);

const SAFE_KEY = /^[A-Za-z0-9_-]{1,64}$/;
const LIMITS = Object.freeze({ depth: 6, keys: 120, array: 200, string: 200 });

class SaveDataService {
  constructor() {
    this._base = null;
  }

  async _getBasePlayer() {
    if (!this._base) {
      const data = await staticJson.load('static/player/auth.json');
      this._base = data?.data?.player ?? {};
    }
    return this._base;
  }

  _defaultFor(field) {
    if (ARRAY_FIELDS.has(field)) return [];
    if (BOOLEAN_FIELDS.has(field)) return false;
    return {};
  }

  // Accounts created before these fields existed in the schema had them dropped by
  // Mongoose strict mode. Seed them from the shipped template on login.
  async ensureDefaults(player) {
    const base = await this._getBasePlayer();
    const changed = [];

    for (const field of OBJECT_FIELDS) {
      const value = player[field];
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        player[field] = base[field] ? structuredClone(base[field]) : {};
        changed.push(field);
      }
    }

    if (!Array.isArray(player.curseRelic)) {
      // Never seed the shared sample catalogue into every account — relics are per-account.
      player.curseRelic = [];
      changed.push('curseRelic');
    }

    for (const field of BOOLEAN_FIELDS) {
      if (typeof player[field] !== 'boolean') {
        player[field] = typeof base[field] === 'boolean' ? base[field] : false;
        changed.push(field);
      }
    }

    if (player.lastSavedAt === undefined) {
      player.lastSavedAt = null;
      changed.push('lastSavedAt');
    }
    if (!player.purchaseCounts || typeof player.purchaseCounts !== 'object' || Array.isArray(player.purchaseCounts)) {
      player.purchaseCounts = {};
      changed.push('purchaseCounts');
    }

    if (changed.length === 0) return false;
    changed.forEach((field) => player.markModified(field));
    await player.save();
    return true;
  }

  // Raw persisted values, in the same shape the client sends back. Avoids the
  // nested-DB-shape vs flat-client-shape mismatch that made saved records read as 0.
  buildClientSaveData(player) {
    const result = {};
    for (const field of CLIENT_SAVE_FIELDS) {
      const value = player[field];
      result[field] = value === undefined || value === null ? this._defaultFor(field) : value;
    }
    return result;
  }

  getSaveData(player) {
    return {
      ...this.buildClientSaveData(player),
      coin: player.coin ?? 0,
      amethyst: player.amethyst ?? 0,
      amulet: player.amulet ?? 0,
      lastSavedAt: player.lastSavedAt ? new Date(player.lastSavedAt).toISOString() : null,
    };
  }

  sanitizeValue(value, depth = 0) {
    if (depth > LIMITS.depth) throw new Error('Invalid save data: nested too deep');

    if (value === null || typeof value === 'boolean') return value;

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Invalid save data: non-finite number');
      return value;
    }

    if (typeof value === 'string') return value.slice(0, LIMITS.string);

    if (Array.isArray(value)) {
      if (value.length > LIMITS.array) throw new Error('Invalid save data: array too long');
      return value.map((entry) => this.sanitizeValue(entry, depth + 1));
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length > LIMITS.keys) throw new Error('Invalid save data: too many keys');

      const clean = {};
      for (const [key, entry] of entries) {
        if (!SAFE_KEY.test(key)) throw new Error(`Invalid save data key: ${key}`);
        clean[key] = this.sanitizeValue(entry, depth + 1);
      }
      return clean;
    }

    throw new Error('Invalid save data: unsupported value');
  }

  mergeObjects(target, patch) {
    const result = target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};

    for (const [key, value] of Object.entries(patch)) {
      const isPlainObject = value && typeof value === 'object' && !Array.isArray(value);
      const current = result[key];
      const currentIsPlain = current && typeof current === 'object' && !Array.isArray(current);
      result[key] = isPlainObject && currentIsPlain ? this.mergeObjects(current, value) : value;
    }
    return result;
  }

  async applySaveData(player, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Invalid save data: object required');
    }

    const updated = [];
    for (const field of CLIENT_WRITABLE_FIELDS) {
      if (payload[field] === undefined) continue;

      const clean = this.sanitizeValue(payload[field]);

      if (BOOLEAN_FIELDS.has(field)) {
        if (typeof clean !== 'boolean') throw new Error(`Invalid save data: ${field} must be a boolean`);
        player[field] = clean;
      } else {
        if (!clean || typeof clean !== 'object' || Array.isArray(clean)) {
          throw new Error(`Invalid save data: ${field} must be an object`);
        }
        player[field] = this.mergeObjects(player[field], clean);
      }

      player.markModified(field);
      updated.push(field);
    }

    if (updated.length === 0) throw new Error('Invalid save data: no writable fields provided');

    player.lastSavedAt = new Date();
    await player.save();

    return { updated, lastSavedAt: player.lastSavedAt.toISOString() };
  }
}

module.exports = new SaveDataService();
module.exports.CLIENT_WRITABLE_FIELDS = CLIENT_WRITABLE_FIELDS;
