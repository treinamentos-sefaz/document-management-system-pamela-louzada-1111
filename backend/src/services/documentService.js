const { randomUUID } = require('node:crypto');
const config = require('../config');
const documentRepository = require('../repositories/documentRepository');

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function toPublicDocument(document) {
  return {
    id: document.id,
    originalName: document.originalName,
    size: document.size,
    uploadedAt: document.uploadedAt,
    owner: document.owner,
  };
}

async function upload(file) {
  if (!file) {
    throw createError(400, 'FILE_REQUIRED', 'Envie um arquivo no campo file.');
  }

  if (file.size === 0) {
    await documentRepository.removeStoredFile(file.filename).catch(() => {});
    throw createError(400, 'EMPTY_FILE', 'O arquivo enviado está vazio.');
  }

  const document = {
    id: randomUUID(),
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner: config.defaultOwner,
    storageKey: file.filename,
    mimeType: file.mimetype,
  };

  try {
    documentRepository.save(document);
  } catch (error) {
    await documentRepository.removeStoredFile(file.filename).catch(() => {});
    throw createError(500, 'STORAGE_ERROR', 'Não foi possível registrar o documento.');
  }

  return toPublicDocument(document);
}

function list() {
  return documentRepository
    .findAll()
    .sort((first, second) => {
      const dateOrder = second.uploadedAt.localeCompare(first.uploadedAt);
      return dateOrder || first.id.localeCompare(second.id);
    })
    .map(toPublicDocument);
}

async function getDownload(id) {
  const document = documentRepository.findById(id);

  if (!document) {
    throw createError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }

  try {
    const exists = await documentRepository.fileExists(document.storageKey);

    if (!exists) {
      documentRepository.deleteMetadata(id);
      throw createError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    }
  } catch (error) {
    if (error.status === 404) {
      throw error;
    }

    throw createError(500, 'STORAGE_ERROR', 'Não foi possível acessar o documento.');
  }

  return {
    stream: documentRepository.createReadStream(document.storageKey),
    originalName: document.originalName,
    mimeType: document.mimeType,
  };
}

module.exports = {
  getDownload,
  list,
  upload,
};