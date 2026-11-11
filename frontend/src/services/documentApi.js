const API_PREFIX = '/api';

async function request(path, options) {
  let response;

  try {
    response = await fetch(`${API_PREFIX}${path}`, options);
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
  }

  if (!response.ok) {
    let payload;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw new Error(payload?.error?.message || 'Não foi possível concluir a operação.');
  }

  return response;
}

export async function listDocuments() {
  const response = await request('/documents');
  const payload = await response.json();

  if (!Array.isArray(payload.documents)) {
    throw new Error('A resposta do servidor está em um formato inválido.');
  }

  return payload.documents;
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request('/upload', {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

export async function downloadDocument(id) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`);
  return response.blob();
}