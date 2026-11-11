// Seed do servidor backend do Document Management System.
//
// Este arquivo é apenas um ponto de partida mínimo. Ao longo do workshop você
// vai usar o Agent Mode do GitHub Copilot para construir as camadas:
//   - routes/       (definição das rotas)
//   - controllers/  (entrada HTTP e validação)
//   - services/     (regras de negócio)
//   - repositories/ (persistência: arquivos locais + metadados em memória)
//
// Restrição do projeto: uploads são gravados no filesystem local da aplicação
// usando multer com diskStorage. Não utilize provedores externos.

const express = require('express');
const multer = require('multer');
const config = require('./config');
const documentRoutes = require('./routes/documentRoutes');

const publicErrorCodes = new Set([
  'EMPTY_FILE',
  'FILE_REQUIRED',
  'FILE_TOO_LARGE',
  'DOCUMENT_NOT_FOUND',
  'INVALID_MULTIPART',
  'INTERNAL_ERROR',
  'STORAGE_ERROR',
  'STORAGE_QUOTA_EXCEEDED',
  'TOO_MANY_UPLOADS',
]);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Endpoint de verificação de saúde. As demais rotas (/upload, /documents,
// /documents/:id/download) serão implementadas durante o Passo 2.
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/', documentRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let status = Number.isInteger(error.status) ? error.status : 500;
  let code = publicErrorCodes.has(error.code) ? error.code : 'INTERNAL_ERROR';
  let message = status >= 500 && code !== 'STORAGE_QUOTA_EXCEEDED'
    ? 'Ocorreu um erro interno.'
    : error.message;

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'FILE_TOO_LARGE';
      message = 'O arquivo excede o limite permitido.';
    } else {
      status = 400;
      code = 'INVALID_MULTIPART';
      message = 'A requisição multipart é inválida.';
    }
  } else if (error.code === 'STORAGE_ERROR') {
    status = 500;
    message = error.message;
  } else if (error.code === 'STORAGE_QUOTA_EXCEEDED') {
    status = 507;
    message = error.message;
  } else if (status === 400 && !publicErrorCodes.has(error.code)) {
    code = 'INVALID_MULTIPART';
    message = 'A requisição multipart é inválida.';
  } else if (status === 404) {
    code = 'DOCUMENT_NOT_FOUND';
    message = 'Documento não encontrado.';
  }

  res.status(status).json({ error: { code, message } });
});

if (require.main === module) {
  app.listen(PORT, config.host, () => {
    console.log(`DMS backend ouvindo em ${config.host}:${PORT}`);
  });
}

module.exports = app;
