import { useRef, useState } from 'react';
import { formatFileSize } from '../services/formatters.js';
import { uploadDocument } from '../services/documentApi.js';

export default function UploadComponent({ onUploaded }) {
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function selectFile(file) {
    setSelectedFile(file || null);
    setError('');
    setSuccess(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedFile || isUploading) {
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess(false);

    try {
      await uploadDocument(selectedFile);
      setSelectedFile(null);
      setSuccess(true);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      onUploaded?.();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <div
        className={`drop-area${isDragging ? ' is-dragging' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <span className="upload-symbol" aria-hidden="true">
          <svg viewBox="0 0 32 32">
            <path d="M16 21V5m0 0-6 6m6-6 6 6M6 20v7h20v-7" />
          </svg>
        </span>
        <span className="selected-file-name">
          {selectedFile ? selectedFile.name : 'Nenhum arquivo selecionado'}
        </span>
        {selectedFile && (
          <span className="selected-file-size">{formatFileSize(selectedFile.size)}</span>
        )}
        <label className="choose-file-button">
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            aria-label="Selecionar arquivo para envio"
            onChange={(event) => selectFile(event.target.files?.[0])}
            disabled={isUploading}
          />
          Selecionar arquivo
        </label>
      </div>

      {selectedFile && (
        <button
          className="clear-file-button"
          type="button"
          onClick={() => {
            selectFile(null);
            if (inputRef.current) {
              inputRef.current.value = '';
            }
          }}
          disabled={isUploading}
        >
          Remover seleção
        </button>
      )}

      {error && <p className="form-message form-error" role="alert">{error}</p>}
      {success && <p className="form-message form-success" role="status">Arquivo enviado.</p>}

      <button className="primary-button upload-submit" type="submit" disabled={!selectedFile || isUploading}>
        {isUploading ? (
          <span className="button-spinner" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 14V3m0 0L6 7m4-4 4 4M4 12v4h12v-4" />
          </svg>
        )}
        {isUploading ? 'Enviando...' : 'Enviar arquivo'}
      </button>
    </form>
  );
}