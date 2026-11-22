'use strict';

const db = require('../db');
const staticUtil = require('../utils/static');

const TAG_FILES = {
  'character,survivor': 'static/store/taglist/C_Survivor.json',
  perksurvivor: 'static/store/taglist/P_Survivor.json',
  'effect,hunter': 'static/store/taglist/Effect_Hunter.json',
  perkhunter: 'static/store/taglist/P_Hunter.json',
  'character,hunter': 'static/store/taglist/C_Hunter.json',
};

const POT_FILES = {
  Default_Gacha: 'static/pots/greedy.json',
  Bullet_Gacha: 'static/pots/bullet.json',
};

const TEMPLATE_FILES = {
  auth: 'static/player/auth.json',
  curserelic: 'static/player/curserelic.json',
  immortal: 'static/player/immortal.json',
  player: 'static/player/PlayerTemplate.json',
  player1: 'static/player/PlayerTemplate1.json',
};

function getPath(object, dotted) {
  return dotted.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);
}

async function arrayFrom(collection, file, keyPath) {
  const documents = await db.collection(collection).find({}).toArray();
  if (documents.length > 0) return documents;
  return getPath(staticUtil.read(file), keyPath) || [];
}

const products = () => arrayFrom('products', 'static/store/P_List.json', 'data.productListing');
const items = () => arrayFrom('items', 'static/store/I_List.json', 'data.items');
const stores = () => arrayFrom('stores', 'static/store/S_List.json', 'data.store');

async function bundles() {
  const documents = await db.collection('bundles').find({}).toArray();
  if (documents.length > 0) return documents;
  const file = staticUtil.read('custom/bundles.json');
  return file.bundles || [];
}

async function saveBundles(list) {
  const collection = db.collection('bundles');
  await collection.deleteMany({});
  const cleaned = list.filter((bundle) => bundle && bundle.shortCode).map((bundle) => {
    const { _id, ...rest } = bundle;
    return rest;
  });
  if (cleaned.length) await collection.insertMany(cleaned);
  staticUtil.clear('custom/bundles.json');
  return cleaned.length;
}

async function keyed(collection, key, file) {
  const document = await db.collection(collection).findOne({ key });
  if (document) return document.data;
  return file ? staticUtil.read(file) : null;
}

const taglist = (key) => keyed('taglists', key, TAG_FILES[key]);
const pots = (code) => keyed('pots', code, POT_FILES[code]);
const template = (key) => keyed('templates', key, TEMPLATE_FILES[key]);

module.exports = {
  products, items, stores, bundles, saveBundles, taglist, pots, template,
  TAG_FILES, POT_FILES, TEMPLATE_FILES,
};
