const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');

const documents = new Map();

function resolveStoragePath(storageKey) {
  if (typeof storageKey !== 'string' || storageKey.length === 0) {
    throw new Error('Chave de armazenamento inválida.');
  }

  const resolvedPath = path.resolve(config.storageDirectory, storageKey);
  const storagePrefix = `${config.storageDirectory}${path.sep}`;

  if (!resolvedPath.startsWith(storagePrefix)) {
    throw new Error('Chave de armazenamento fora do diretório permitido.');
  }

  return resolvedPath;
}

function save(document) {
  documents.set(document.id, document);
  return document;
}

function findAll() {
  return Array.from(documents.values());
}

function findById(id) {
  return documents.get(id) || null;
}

function deleteMetadata(id) {
  documents.delete(id);
}

async function fileExists(storageKey) {
  try {
    await fsPromises.access(resolveStoragePath(storageKey));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function createReadStream(storageKey) {
  return fs.createReadStream(resolveStoragePath(storageKey));
}

async function removeStoredFile(storageKey) {
  try {
    await fsPromises.unlink(resolveStoragePath(storageKey));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function clear() {
  const storageKeys = findAll().map((document) => document.storageKey);
  documents.clear();
  await Promise.all(storageKeys.map(removeStoredFile));
}

module.exports = {
  clear,
  createReadStream,
  deleteMetadata,
  fileExists,
  findAll,
  findById,
  removeStoredFile,
  save,
};