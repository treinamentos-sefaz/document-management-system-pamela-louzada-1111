const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const fsPromises = require('node:fs/promises');
const path = require('node:path');

process.env.DMS_MAX_FILE_SIZE_BYTES = '8';
process.env.DMS_DEFAULT_OWNER = 'test-owner';

const app = require('../src/app');
const config = require('../src/config');
const documentRepository = require('../src/repositories/documentRepository');

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('upload, listagem e download de documentos', async (t) => {
  await documentRepository.initialize();
  await documentRepository.clear();

  const concurrentReservations = Array.from(
    { length: config.maxConcurrentUploads },
    () => documentRepository.reserveUpload(randomUUID()),
  );
  assert.throws(
    () => documentRepository.reserveUpload(randomUUID()),
    { code: 'TOO_MANY_UPLOADS' },
  );
  concurrentReservations.forEach((reservation) => reservation.release());

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

  const extraFieldForm = new FormData();
  extraFieldForm.set('file', new Blob(['hello']), 'hello.txt');
  extraFieldForm.set('description', 'campo não permitido');
  const extraFieldResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: extraFieldForm,
  });
  assert.equal(extraFieldResponse.status, 400);
  assert.equal((await extraFieldResponse.json()).error.code, 'INVALID_MULTIPART');

  const form = new FormData();
  form.set('file', new Blob(['hello'], { type: 'text/plain' }), 'hello.txt');
  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: form,
  });

  const uploadPayload = await uploadResponse.json();
  assert.equal(uploadResponse.status, 201, JSON.stringify(uploadPayload));
  const document = uploadPayload;
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

  const configuredMaxStorageBytes = config.maxStorageBytes;
  config.maxStorageBytes = document.size;
  const quotaForm = new FormData();
  quotaForm.set('file', new Blob(['a']), 'quota.txt');
  const quotaResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: quotaForm,
  });
  config.maxStorageBytes = configuredMaxStorageBytes;
  assert.equal(quotaResponse.status, 507);
  assert.equal((await quotaResponse.json()).error.code, 'STORAGE_QUOTA_EXCEEDED');

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

  const symlinkId = randomUUID();
  const symlinkKey = randomUUID();
  const symlinkPath = path.join(config.storageDirectory, symlinkKey);
  const targetPath = path.join(config.storageDirectory, randomUUID());
  let symlinkReservation;

  try {
    await fsPromises.writeFile(targetPath, 'must not be downloaded');
    await fsPromises.symlink(targetPath, symlinkPath);
    symlinkReservation = documentRepository.reserveUpload(symlinkKey);
    symlinkReservation.commit({
      id: symlinkId,
      originalName: 'secret.txt',
      size: 6,
      uploadedAt: new Date().toISOString(),
      owner: 'test-owner',
      storageKey: symlinkKey,
      mimeType: 'text/plain',
    });

    const symlinkResponse = await fetch(`${baseUrl}/documents/${symlinkId}/download`);
    assert.equal(symlinkResponse.status, 404);
    assert.equal((await symlinkResponse.json()).error.code, 'DOCUMENT_NOT_FOUND');
    await assert.rejects(documentRepository.createReadStream('../outside-file'));
  } finally {
    symlinkReservation?.release();
    await documentRepository.removeStoredFile(symlinkKey).catch(() => {});
    await fsPromises.unlink(targetPath).catch(() => {});
  }
});
