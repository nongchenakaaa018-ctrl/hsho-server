'use strict';

const db = require('../db');

const KEY = 'server';
const DEFAULTS = {
  serverVersion: '1.0.6.0',
  ServerDevVersion: '1.0.6.0',
  IsOnline: true,
  IsDevOnline: true,
  maintenance: false,
};

async function get() {
  const document = await db.collection('settings').findOne({ key: KEY });
  return { ...DEFAULTS, ...(document?.value || {}) };
}

async function set(patch) {
  const current = await get();
  const value = { ...current, ...patch };
  await db.collection('settings').replaceOne({ key: KEY }, { key: KEY, value }, { upsert: true });
  return value;
}

module.exports = { get, set, DEFAULTS };
