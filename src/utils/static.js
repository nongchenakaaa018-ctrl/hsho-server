'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');

const cache = new Map();

function read(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const target = path.join(config.paths.data, relative);
  const value = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (config.env === 'production') cache.set(relative, value);
  return value;
}

function clear(relative) {
  if (relative) cache.delete(relative);
  else cache.clear();
}

module.exports = { read, clear };
