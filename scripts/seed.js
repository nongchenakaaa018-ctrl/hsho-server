'use strict';

// Imports the shipped static JSON into MongoDB so the catalogue lives in the
// database (editable, survives Render restarts). Safe to run repeatedly.
const db = require('../src/db');
const staticUtil = require('../src/utils/static');
const catalogRepo = require('../src/repositories/catalog.repo');

async function upsertMany(collectionName, documents, key = '_id') {
  if (!Array.isArray(documents) || documents.length === 0) {
    console.log(`[Seed] ${collectionName}: 0 (skipped)`);
    return 0;
  }
  const collection = db.collection(collectionName);
  for (const document of documents) {
    const filter = document[key] !== undefined ? { [key]: document[key] } : document;
    await collection.replaceOne(filter, document, { upsert: true });
  }
  console.log(`[Seed] ${collectionName}: ${documents.length}`);
  return documents.length;
}

async function upsertKeyed(collectionName, mapping) {
  const collection = db.collection(collectionName);
  let count = 0;
  for (const [key, file] of Object.entries(mapping)) {
    const data = staticUtil.read(file);
    await collection.replaceOne({ key }, { key, data }, { upsert: true });
    count += 1;
  }
  console.log(`[Seed] ${collectionName}: ${count}`);
  return count;
}

async function main() {
  await db.connect();

  await upsertMany('products', staticUtil.read('static/store/P_List.json')?.data?.productListing);
  await upsertMany('items', staticUtil.read('static/store/I_List.json')?.data?.items);
  await upsertMany('stores', staticUtil.read('static/store/S_List.json')?.data?.store);
  await upsertKeyed('taglists', catalogRepo.TAG_FILES);
  await upsertKeyed('pots', catalogRepo.POT_FILES);
  await upsertKeyed('templates', catalogRepo.TEMPLATE_FILES);

  const bundles = staticUtil.read('custom/bundles.json')?.bundles || [];
  const saved = await catalogRepo.saveBundles(bundles);
  console.log(`[Seed] bundles: ${saved}`);

  console.log('\n[Seed] Done. Static catalogue is now stored in MongoDB.');
  await db.close();
}

main().catch(async (error) => {
  console.error('[Seed] Failed:', error);
  try { await db.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
