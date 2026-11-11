const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

process.env.DMS_MAX_FILE_SIZE_BYTES = '8';
process.env.DMS_DEFAULT_OWNER = 'test-owner';

const app = require('../src/app');
const documentRepository = require('../src/repositories/documentRepository');

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('upload, listagem e download de documentos', async (t) => {
  await documentRepository.clear();

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await documentRepository.clear();
  });

  const emptyListResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(emptyListResponse.status, 200);
  assert.deepEqual(await emptyListResponse.json(), { documents: [] });

  const missingFileResponse = await fetch(`${baseUrl}/upload`, { method: 'POST' });
  assert.equal(missingFileResponse.status, 400);
  assert.equal((await missingFileResponse.json()).error.code, 'FILE_REQUIRED');

  const malformedResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data; boundary=broken' },
    body: '--broken\r\nContent-Disposition: form-data; name="file"; filename="partial.txt"\r\n\r\npartial',
  });
  assert.equal(malformedResponse.status, 400);
  assert.equal((await malformedResponse.json()).error.code, 'INVALID_MULTIPART');

  const form = new FormData();
  form.set('file', new Blob(['hello'], { type: 'text/plain' }), 'hello.txt');
  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: form,
  });

  assert.equal(uploadResponse.status, 201);
  const document = await uploadResponse.json();
  assert.equal(document.originalName, 'hello.txt');
  assert.equal(document.size, 5);
  assert.equal(document.owner, 'test-owner');
  assert.match(document.uploadedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal('storageKey' in document, false);

  const listResponse = await fetch(`${baseUrl}/documents`);
  assert.deepEqual(await listResponse.json(), { documents: [document] });

  const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`);
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /^attachment;/);
  assert.equal(await downloadResponse.text(), 'hello');

  const missingResponse = await fetch(`${baseUrl}/documents/unknown/download`);
  assert.equal(missingResponse.status, 404);
  assert.equal((await missingResponse.json()).error.code, 'DOCUMENT_NOT_FOUND');

  const emptyForm = new FormData();
  emptyForm.set('file', new Blob([]), 'empty.txt');
  const emptyUploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: emptyForm,
  });
  assert.equal(emptyUploadResponse.status, 400);
  assert.equal((await emptyUploadResponse.json()).error.code, 'EMPTY_FILE');

  const largeForm = new FormData();
  largeForm.set('file', new Blob(['123456789']), 'large.txt');
  const largeUploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: largeForm,
  });
  assert.equal(largeUploadResponse.status, 413);
  assert.equal((await largeUploadResponse.json()).error.code, 'FILE_TOO_LARGE');

  const finalListResponse = await fetch(`${baseUrl}/documents`);
  assert.equal((await finalListResponse.json()).documents.length, 1);
});
