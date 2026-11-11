const path = require('node:path');

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const configuredMaxFileSize = process.env.DMS_MAX_FILE_SIZE_BYTES;
const maxFileSizeBytes = configuredMaxFileSize === undefined
  ? DEFAULT_MAX_FILE_SIZE_BYTES
  : Number(configuredMaxFileSize);

if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
  throw new Error('DMS_MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
}

module.exports = {
  defaultOwner: process.env.DMS_DEFAULT_OWNER || 'local-user',
  maxFileSizeBytes,
  storageDirectory: path.resolve(__dirname, '../storage'),
};