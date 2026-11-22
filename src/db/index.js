'use strict';

const { MongoClient } = require('mongodb');
const config = require('../config');
const { MemoryDb } = require('./memory');

let database = null;
let client = null;
let driver = config.db.driver;

async function ensureIndexes(db) {
  await db.collection('players').createIndex({ steamId: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
  await db.collection('bundles').createIndex({ shortCode: 1 }, { unique: true });
  await db.collection('products').createIndex({ shortCode: 1 });
  await db.collection('items').createIndex({ shortCode: 1 });
  await db.collection('settings').createIndex({ key: 1 }, { unique: true });
  await db.collection('transactions').createIndex({ orderId: 1 }, { unique: true });
  await db.collection('transactions').createIndex({ steamId: 1, createdAt: -1 });
}

async function connect() {
  if (driver === 'memory') {
    database = new MemoryDb();
    console.warn('[DB] IN-MEMORY driver — data will be lost on restart (local testing only)');
    return database;
  }

  if (!config.mongo.uri) {
    throw new Error('MONGODB_URI is required. Set it in Render, or use DB_DRIVER=memory locally.');
  }

  client = new MongoClient(config.mongo.uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
  });
  await client.connect();
  database = client.db(config.mongo.dbName);
  await ensureIndexes(database);
  console.log(`[DB] MongoDB connected — database "${config.mongo.dbName}"`);
  return database;
}

function collection(name) {
  if (!database) throw new Error('Database is not connected');
  return database.collection(name);
}

function isReady() { return Boolean(database); }
function getDriver() { return driver; }

async function close() {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}

module.exports = { connect, collection, isReady, getDriver, close };
