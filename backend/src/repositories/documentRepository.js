const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');

const documents = new Map();
const storedFiles = new Map();
let storageBytes = 0;
let reservedBytes = 0;
let reservedDocuments = 0;
let initialization;

function resolveStoragePath(storageKey) {
  if (typeof storageKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(storageKey)) {
    throw new Error('Chave de armazenamento inválida.');
  }

  const resolvedPath = path.resolve(config.storageDirectory, storageKey);
  const relativePath = path.relative(config.storageDirectory, resolvedPath);

  if (
    relativePath.length === 0
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new Error('Chave de armazenamento fora do diretório permitido.');
  }

  return resolvedPath;
}

function initialize() {
  if (!initialization) {
    initialization = (async () => {
      await fsPromises.mkdir(config.storageDirectory, { recursive: true });
      const entries = await fsPromises.readdir(config.storageDirectory, { withFileTypes: true });
      const discoveredFiles = new Map();
      let discoveredBytes = 0;

      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }

        const entryPath = path.join(config.storageDirectory, entry.name);
        const stats = await fsPromises.lstat(entryPath);

        if (stats.isFile()) {
          discoveredFiles.set(entry.name, stats.size);
          discoveredBytes += stats.size;
        }
      }

      storedFiles.clear();
      for (const [filename, size] of discoveredFiles) {
        storedFiles.set(filename, size);
      }
      storageBytes = discoveredBytes;
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }

  return initialization;
}

function reserveUpload(storageKey) {
  if (!initialization) {
    throw new Error('O repositório de documentos ainda não foi inicializado.');
  }

  if (reservedDocuments >= config.maxConcurrentUploads) {
    const error = new Error('O limite de uploads simultâneos foi atingido.');
    error.status = 429;
    error.code = 'TOO_MANY_UPLOADS';
    throw error;
  }

  const maximumBytes = Math.min(
    config.maxFileSizeBytes,
    config.maxStorageBytes - storageBytes - reservedBytes,
  );

  if (documents.size + reservedDocuments >= config.maxDocuments || maximumBytes <= 0) {
    const error = new Error('A cota de armazenamento do DMS foi atingida.');
    error.status = 507;
    error.code = 'STORAGE_QUOTA_EXCEEDED';
    throw error;
  }

  reservedBytes += maximumBytes;
  reservedDocuments += 1;
  let isActive = true;

  function release() {
    if (!isActive) {
      return;
    }

    reservedBytes -= maximumBytes;
    reservedDocuments -= 1;
    isActive = false;
  }

  return {
    storageKey,
    maximumBytes,
    release,
    commit(document) {
      if (!isActive || document.storageKey !== storageKey) {
        throw new Error('Reserva de upload inválida.');
      }

      if (document.size > maximumBytes) {
        throw new Error('O arquivo excede o tamanho reservado.');
      }

      documents.set(document.id, document);
      storedFiles.set(storageKey, document.size);
      storageBytes += document.size;
      release();
    },
  };
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

async function createReadStream(storageKey) {
  const fileHandle = await fsPromises.open(
    resolveStoragePath(storageKey),
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );

  try {
    const stats = await fileHandle.stat();

    if (!stats.isFile()) {
      const error = new Error('O documento armazenado não é um arquivo regular.');
      error.code = 'EISDIR';
      throw error;
    }

    return fileHandle.createReadStream();
  } catch (error) {
    await fileHandle.close().catch(() => {});
    throw error;
  }
}

function forgetStoredFile(storageKey) {
  const size = storedFiles.get(storageKey);

  if (size === undefined) {
    return;
  }

  storedFiles.delete(storageKey);
  storageBytes = Math.max(0, storageBytes - size);
}

async function removeStoredFile(storageKey) {
  try {
    await fsPromises.unlink(resolveStoragePath(storageKey));
    forgetStoredFile(storageKey);
  } catch (error) {
    if (error.code === 'ENOENT') {
      forgetStoredFile(storageKey);
      return;
    }

    throw error;
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
  forgetStoredFile,
  findAll,
  findById,
  initialize,
  removeStoredFile,
  reserveUpload,
};