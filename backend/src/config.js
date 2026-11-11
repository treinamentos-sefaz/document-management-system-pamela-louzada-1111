const path = require('node:path');

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function readPositiveInteger(name, defaultValue) {
  const rawValue = process.env[name];
  const value = rawValue === undefined ? defaultValue : Number(rawValue);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }

  return value;
}

const maxFileSizeBytes = readPositiveInteger(
  'DMS_MAX_FILE_SIZE_BYTES',
  DEFAULT_MAX_FILE_SIZE_BYTES,
);
const maxStorageBytes = readPositiveInteger('DMS_MAX_STORAGE_BYTES', 1024 * 1024 * 1024);
const maxDocuments = readPositiveInteger('DMS_MAX_DOCUMENTS', 1000);
const maxConcurrentUploads = readPositiveInteger('DMS_MAX_CONCURRENT_UPLOADS', 8);

if (maxStorageBytes < maxFileSizeBytes) {
  throw new Error('DMS_MAX_STORAGE_BYTES não pode ser menor que DMS_MAX_FILE_SIZE_BYTES.');
}

module.exports = {
  defaultOwner: process.env.DMS_DEFAULT_OWNER || 'local-user',
  host: process.env.DMS_HOST || '127.0.0.1',
  maxConcurrentUploads,
  maxDocuments,
  maxFileSizeBytes,
  maxStorageBytes,
  storageDirectory: path.resolve(__dirname, '../storage'),
};