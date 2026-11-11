import { useState } from 'react';
import { downloadDocument } from '../services/documentApi.js';

function safeFilename(filename) {
  return filename.replace(/[\\/\u0000-\u001f]/g, '_') || 'documento';
}

export default function DownloadButton({ fileRecord }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    setIsDownloading(true);
    setError('');

    try {
      const fileBlob = await downloadDocument(fileRecord.id);
      const downloadUrl = URL.createObjectURL(fileBlob);
      const link = window.document.createElement('a');
      link.href = downloadUrl;
      link.download = safeFilename(fileRecord.originalName);
      link.hidden = true;
      window.document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="download-action">
      <button
        className="download-button"
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        aria-label={`Baixar ${fileRecord.originalName}`}
      >
        {isDownloading ? (
          <span className="button-spinner button-spinner-small" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 3v10m0 0 4-4m-4 4L6 9M4 13v4h12v-4" />
          </svg>
        )}
        {isDownloading ? 'Baixando' : 'Baixar'}
      </button>
      {error && <span className="download-error" role="alert">{error}</span>}
    </div>
  );
}