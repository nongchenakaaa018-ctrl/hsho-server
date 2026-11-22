'use strict';

const db = require('../db');

const COLLECTION = 'players';

async function find(steamId) {
  return db.collection(COLLECTION).findOne({ steamId });
}

async function all() {
  return db.collection(COLLECTION).find({}).toArray();
}

async function count() {
  return db.collection(COLLECTION).countDocuments({});
}

async function upsert(player) {
  await db.collection(COLLECTION).replaceOne({ steamId: player.steamId }, player, { upsert: true });
  return player;
}

// Atomic debit — the filter guarantees the player cannot be charged twice or
// go negative, even if two purchase requests arrive at the same time.
async function debit(steamId, currency, amount) {
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { steamId, [currency]: { $gte: amount } },
    { $inc: { [currency]: -amount } },
    { returnDocument: 'after' }
  );
  // mongodb v6 returns the document directly; older versions wrap it in { value }.
  return result ? (result.value || result) : null;
}

async function recordTransaction(transaction) {
  await db.collection('transactions').insertOne(transaction);
  return transaction;
}

async function patch(steamId, mutator) {
  const player = await find(steamId);
  if (!player) return null;
  mutator(player);
  return upsert(player);
}

module.exports = { find, all, count, upsert, debit, patch, recordTransaction };
