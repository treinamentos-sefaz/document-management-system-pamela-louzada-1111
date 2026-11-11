import DownloadButton from './DownloadButton.jsx';
import { formatDate, formatFileSize } from '../services/formatters.js';

function getFileExtension(filename) {
  const extension = filename.split('.').pop();
  return extension && extension !== filename ? extension.slice(0, 4).toUpperCase() : 'ARQ';
}

export default function DocumentList({ documents, isLoading, error, onRetry }) {
  if (isLoading && documents.length === 0) {
    return (
      <div className="document-state loading-state" role="status" aria-live="polite">
        <span className="loading-line" />
        <span className="loading-line loading-line-short" />
        <span className="loading-label">Carregando documentos...</span>
      </div>
    );
  }

  if (error && documents.length === 0) {
    return (
      <div className="document-state error-state" role="alert">
        <p>{error}</p>
        <button className="text-button" type="button" onClick={onRetry}>Tentar novamente</button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="document-state empty-state">
        <span className="empty-mark" aria-hidden="true">—</span>
        <p>Nenhum documento</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={onRetry}>Tentar novamente</button>
        </div>
      )}
      <ul className="document-list" aria-busy={isLoading}>
        {documents.map((fileRecord) => (
          <li className="document-row" key={fileRecord.id}>
            <span className="file-type" aria-hidden="true">{getFileExtension(fileRecord.originalName)}</span>
            <div className="document-info">
              <span className="document-name" title={fileRecord.originalName}>
                {fileRecord.originalName}
              </span>
              <span className="document-meta">
                <span>{formatFileSize(fileRecord.size)}</span>
                <span className="meta-divider" aria-hidden="true">/</span>
                <time dateTime={fileRecord.uploadedAt}>{formatDate(fileRecord.uploadedAt)}</time>
              </span>
            </div>
            <DownloadButton fileRecord={fileRecord} />
          </li>
        ))}
      </ul>
    </>
  );
}