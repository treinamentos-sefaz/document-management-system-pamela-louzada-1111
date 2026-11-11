const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const multer = require('multer');
const express = require('express');
const config = require('../config');
const documentController = require('../controllers/documentController');
const documentRepository = require('../repositories/documentRepository');

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, callback) {
    fs.mkdir(config.storageDirectory, { recursive: true }, (error) => {
      callback(error, config.storageDirectory);
    });
  },
  filename(req, file, callback) {
    callback(null, req.storageKey);
  },
});

const storageErrorCodes = new Set([
  'EACCES',
  'EBADF',
  'EIO',
  'EMFILE',
  'ENFILE',
  'ENOSPC',
  'ENOENT',
  'ENOTDIR',
  'EPERM',
  'EROFS',
]);

async function receiveFile(req, res, next) {
  await documentRepository.initialize();
  const storageKey = randomUUID();
  const reservation = documentRepository.reserveUpload(storageKey);
  req.storageKey = storageKey;
  req.uploadReservation = reservation;
  res.once('close', reservation.release);

  const upload = multer({
    storage,
    limits: {
      fileSize: reservation.maximumBytes,
      files: 1,
      fields: 0,
      parts: 2,
      fieldNameSize: 100,
      headerPairs: 100,
    },
  });

  upload.single('file')(req, res, (error) => {
    if (!error) {
      if (!req.file) {
        reservation.release();
      }

      next(error);
      return;
    }

    reservation.release();

    if (error instanceof multer.MulterError) {
      if (
        error.code === 'LIMIT_FILE_SIZE'
        && reservation.maximumBytes < config.maxFileSizeBytes
      ) {
        const quotaError = new Error('A cota de armazenamento do DMS foi atingida.');
        quotaError.status = 507;
        quotaError.code = 'STORAGE_QUOTA_EXCEEDED';
        next(quotaError);
        return;
      }

      next(error);
      return;
    }

    if (storageErrorCodes.has(error.code)) {
      const storageError = new Error('Não foi possível gravar o arquivo.');
      storageError.code = 'STORAGE_ERROR';
      next(storageError);
      return;
    }

    const multipartError = new Error('A requisição multipart é inválida.');
    multipartError.status = 400;
    multipartError.code = 'INVALID_MULTIPART';
    next(multipartError);
  });
}

router.post('/upload', receiveFile, documentController.upload);
router.get('/documents', documentController.list);
router.get('/documents/:id/download', documentController.download);

module.exports = router;