const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const multer = require('multer');
const express = require('express');
const config = require('../config');
const documentController = require('../controllers/documentController');

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, callback) {
    fs.mkdir(config.storageDirectory, { recursive: true }, (error) => {
      callback(error, config.storageDirectory);
    });
  },
  filename(req, file, callback) {
    callback(null, randomUUID());
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSizeBytes,
    files: 1,
  },
});

function receiveFile(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error || error instanceof multer.MulterError) {
      next(error);
      return;
    }

    const storageErrorCodes = new Set([
      'EACCES',
      'EIO',
      'EMFILE',
      'ENFILE',
      'ENOSPC',
      'EPERM',
      'EROFS',
    ]);

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