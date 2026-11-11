const documentService = require('../services/documentService');

async function upload(req, res) {
  const document = await documentService.upload(req.file);
  res.status(201).json(document);
}

function list(req, res) {
  res.status(200).json({ documents: documentService.list() });
}

async function download(req, res, next) {
  const document = await documentService.getDownload(req.params.id);
  const safeName = document.originalName.replace(/[\\/\r\n\0]/g, '_') || 'document';
  const safeMimeType = /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(document.mimeType)
    ? document.mimeType
    : 'application/octet-stream';

  res.attachment(safeName);
  res.type(safeMimeType);
  document.stream.on('error', (error) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }

    next(error);
  });
  document.stream.pipe(res);
}

module.exports = {
  download,
  list,
  upload,
};