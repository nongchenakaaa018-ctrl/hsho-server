'use strict';

const crypto = require('crypto');
const db = require('../db');
const config = require('../config');

const COLLECTION = 'sessions';

async function create(steamId) {
  const token = crypto.randomBytes(24).toString('hex');
  await db.collection(COLLECTION).insertOne({
    token,
    steamId,
    createdAt: new Date().toISOString(),
    expires: Date.now() + config.sessionTtlMs,
  });
  return token;
}

async function find(token) {
  return db.collection(COLLECTION).findOne({ token });
}

async function remove(token) {
  await db.collection(COLLECTION).deleteOne({ token });
}

module.exports = { create, find, remove };
