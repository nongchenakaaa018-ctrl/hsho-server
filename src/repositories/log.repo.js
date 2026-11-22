'use strict';

const db = require('../db');

const COLLECTION = 'logs';
const MAX_LOGS = 500;

async function append(type, body, ip = '') {
  await db.collection(COLLECTION).insertOne({
    type,
    ip,
    body,
    at: new Date().toISOString(),
  });
  // Keep the collection bounded (cheap enough for a game API).
  const count = await db.collection(COLLECTION).countDocuments({});
  if (count > MAX_LOGS) {
    const oldest = await db.collection(COLLECTION).find({}).sort({ at: 1 }).limit(count - MAX_LOGS).toArray();
    for (const doc of oldest) {
      await db.collection(COLLECTION).deleteOne({ _id: doc._id });
    }
  }
}

async function recent(limit = 50) {
  return db.collection(COLLECTION).find({}).sort({ at: -1 }).limit(limit).toArray();
}

module.exports = { append, recent };
