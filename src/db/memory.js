'use strict';

// Tiny in-memory implementation of the MongoDB collection methods used by the
// repositories. Only enabled with DB_DRIVER=memory for local development/tests.
const { ObjectId } = require('mongodb');

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function match(doc, filter = {}) {
  for (const [key, cond] of Object.entries(filter || {})) {
    const value = doc[key];
    const isOperatorObject = cond && typeof cond === 'object' && !Array.isArray(cond) &&
      Object.keys(cond).some((k) => k.startsWith('$'));

    if (!isOperatorObject) {
      if (value !== cond) return false;
      continue;
    }

    for (const [op, target] of Object.entries(cond)) {
      switch (op) {
        case '$eq': if (value !== target) return false; break;
        case '$ne': if (value === target) return false; break;
        case '$gt': if (!(value > target)) return false; break;
        case '$gte': if (!(value >= target)) return false; break;
        case '$lt': if (!(value < target)) return false; break;
        case '$lte': if (!(value <= target)) return false; break;
        case '$in': if (!Array.isArray(target) || !target.includes(value)) return false; break;
        case '$nin': if (Array.isArray(target) && target.includes(value)) return false; break;
        case '$exists': if ((value !== undefined) !== Boolean(target)) return false; break;
        default: return false;
      }
    }
  }
  return true;
}

function applyUpdate(doc, update = {}) {
  for (const [op, fields] of Object.entries(update)) {
    if (op === '$set') {
      Object.assign(doc, clone(fields));
    } else if (op === '$inc') {
      for (const [key, amount] of Object.entries(fields)) {
        doc[key] = (Number(doc[key]) || 0) + Number(amount);
      }
    } else if (op === '$push') {
      for (const [key, value] of Object.entries(fields)) {
        if (!Array.isArray(doc[key])) doc[key] = [];
        doc[key].push(clone(value));
      }
    } else if (op === '$pull') {
      for (const [key, value] of Object.entries(fields)) {
        if (Array.isArray(doc[key])) doc[key] = doc[key].filter((entry) => entry !== value);
      }
    } else if (op === '$unset') {
      for (const key of Object.keys(fields)) delete doc[key];
    }
  }
}

class Cursor {
  constructor(docs) { this.docs = docs; }
  sort(spec = {}) {
    const entries = Object.entries(spec);
    this.docs = [...this.docs].sort((a, b) => {
      for (const [key, direction] of entries) {
        const av = a[key]; const bv = b[key];
        const cmp = av === bv ? 0 : av > bv ? 1 : -1;
        if (cmp) return direction === -1 ? -cmp : cmp;
      }
      return 0;
    });
    return this;
  }
  skip(n) { this.docs = this.docs.slice(n); return this; }
  limit(n) { this.docs = this.docs.slice(0, n); return this; }
  async toArray() { return clone(this.docs); }
}

class MemoryCollection {
  constructor(name) { this.name = name; this.docs = []; }

  async createIndex() { return this.name; }
  async findOne(filter = {}) {
    const found = this.docs.find((doc) => match(doc, filter));
    return found ? clone(found) : null;
  }
  find(filter = {}) { return new Cursor(this.docs.filter((doc) => match(doc, filter))); }
  async insertOne(doc) {
    const stored = clone(doc);
    if (!stored._id) stored._id = new ObjectId().toHexString();
    this.docs.push(stored);
    return { acknowledged: true, insertedId: stored._id };
  }
  async insertMany(docs) {
    const ids = [];
    for (const doc of docs) ids.push((await this.insertOne(doc)).insertedId);
    return { acknowledged: true, insertedIds: ids };
  }
  async updateOne(filter, update) {
    const found = this.docs.find((doc) => match(doc, filter));
    if (!found) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    applyUpdate(found, update);
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }
  async updateMany(filter, update) {
    let count = 0;
    for (const doc of this.docs) {
      if (match(doc, filter)) { applyUpdate(doc, update); count += 1; }
    }
    return { acknowledged: true, matchedCount: count, modifiedCount: count };
  }
  async replaceOne(filter, doc, options = {}) {
    const index = this.docs.findIndex((entry) => match(entry, filter));
    if (index < 0) {
      if (!options.upsert) return { acknowledged: true, matchedCount: 0 };
      const stored = clone(doc);
      if (!stored._id) stored._id = new ObjectId().toHexString();
      this.docs.push(stored);
      return { acknowledged: true, matchedCount: 0, upsertedId: stored._id };
    }
    const stored = clone(doc);
    stored._id = this.docs[index]._id;
    this.docs[index] = stored;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }
  async findOneAndUpdate(filter, update) {
    const found = this.docs.find((doc) => match(doc, filter));
    if (!found) return null;
    applyUpdate(found, update);
    return clone(found);
  }
  async deleteOne(filter) {
    const index = this.docs.findIndex((doc) => match(doc, filter));
    if (index < 0) return { acknowledged: true, deletedCount: 0 };
    this.docs.splice(index, 1);
    return { acknowledged: true, deletedCount: 1 };
  }
  async deleteMany(filter) {
    const before = this.docs.length;
    this.docs = this.docs.filter((doc) => !match(doc, filter));
    return { acknowledged: true, deletedCount: before - this.docs.length };
  }
  async countDocuments(filter = {}) {
    return this.docs.filter((doc) => match(doc, filter)).length;
  }
}

class MemoryDb {
  constructor() { this.collections = new Map(); }
  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new MemoryCollection(name));
    return this.collections.get(name);
  }
}

module.exports = { MemoryDb, MemoryCollection, match, applyUpdate, clone };
