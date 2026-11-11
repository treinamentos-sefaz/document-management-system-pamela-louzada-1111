import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments } from './services/documentApi.js';
import './App.css';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    setIsLoading(true);
    setLoadError('');

    listDocuments()
      .then((items) => {
        if (isCurrent) {
          setDocuments(items);
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setLoadError(error.message);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [refreshVersion]);

  function refreshDocuments() {
    setRefreshVersion((version) => version + 1);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main-content" aria-label="Documentos, início">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span className="brand-name">Arquivo</span>
        </a>
        <div className="storage-indicator">
          <span className="status-dot" aria-hidden="true" />
          Armazenamento local
        </div>
      </header>

      <main className="main-content" id="main-content">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">BIBLIOTECA</p>
            <h1 id="page-title">Documentos</h1>
          </div>
          <div className="document-count" aria-live="polite">
            <span className="count-number">{documents.length.toString().padStart(2, '0')}</span>
            <span className="count-label">itens</span>
          </div>
        </section>

        <div className="workspace">
          <section className="upload-panel" aria-labelledby="upload-title">
            <div className="section-heading">
              <span className="section-index">01</span>
              <h2 id="upload-title">Adicionar arquivo</h2>
            </div>
            <UploadComponent onUploaded={refreshDocuments} />
          </section>

          <section className="documents-panel" aria-labelledby="documents-title">
            <div className="section-heading document-section-heading">
              <div className="section-title-group">
                <span className="section-index">02</span>
                <h2 id="documents-title">Todos os documentos</h2>
              </div>
              <button
                className="refresh-button"
                type="button"
                onClick={refreshDocuments}
                disabled={isLoading}
                aria-label="Atualizar lista de documentos"
                title="Atualizar lista"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M16.2 8a6.5 6.5 0 0 0-11.1-2L3.5 7.5M3.5 7.5V3.8m0 3.7h3.7M3.8 12a6.5 6.5 0 0 0 11.1 2l1.6-1.5m0 0v3.7m0-3.7h-3.7" />
                </svg>
              </button>
            </div>
            <DocumentList
              documents={documents}
              isLoading={isLoading}
              error={loadError}
              onRetry={refreshDocuments}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
