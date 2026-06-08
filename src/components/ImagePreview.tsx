import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ImagePreviewProps {
  url: string;
  alt?: string;
  height?: number;
}

export default function ImagePreview({ url, alt = 'Preview', height = 120 }: ImagePreviewProps) {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!url.trim()) return null;

  return (
    <div
      style={{
        marginTop: '8px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--border-glass)',
        background: 'rgba(0,0,0,0.2)',
        height: `${height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {hasError ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
          <ImageOff size={24} />
          <span style={{ fontSize: '11px' }}>Failed to load image</span>
        </div>
      ) : (
        <img
          src={url}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        />
      )}
      {!loaded && !hasError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '11px',
        }}>
          Loading...
        </div>
      )}
    </div>
  );
}
