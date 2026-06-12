import React, { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';

// Format timestamp
export const formatFreshness = (timestamp?: number) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Parse inline markdown: links, bold, italics, code
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  // Regex matches bold (**), italics (*), code (`) or links ([label](url))
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code 
          key={index} 
          style={{ 
            background: 'rgba(255,255,255,0.08)', 
            padding: '2px 4px', 
            borderRadius: '4px', 
            fontFamily: 'monospace',
            fontSize: '90%',
            border: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('[') && part.includes('](')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <a
            key={index}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}
            onClick={(e) => e.stopPropagation()}
          >
            {match[1]}
          </a>
        );
      }
    }
    return part;
  });
}

interface AiMarkdownSectionProps {
  content: string;
  updatedAt?: number;
  className?: string;
  style?: React.CSSProperties;
  onSave?: (newContent: string) => void;
  canEdit?: boolean;
  title?: React.ReactNode;
}

export default function AiMarkdownSection({ 
  content, 
  updatedAt, 
  className = 'ai-checklist-markdown',
  style,
  onSave,
  canEdit = true,
  title
}: AiMarkdownSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  useEffect(() => {
    setDraft(content);
  }, [content]);

  // If there's no content and we are not editing, render nothing
  if (!content && !isEditing) return null;

  const lines = draft.split('\n');
  const showHeader = (updatedAt !== undefined && updatedAt > 0) || (onSave && canEdit) || !!title;

  return (
    <div className={className} style={{ textTransform: 'none', display: 'flex', flexDirection: 'column', ...style }}>
      {showHeader && (
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '8px', 
            borderBottom: '1px solid rgba(255,255,255,0.05)', 
            paddingBottom: '6px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {title && title}
            {updatedAt !== undefined && updatedAt > 0 && (
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                Updated: {formatFreshness(updatedAt)}
              </div>
            )}
          </div>
          {onSave && canEdit && (
            <div style={{ display: 'flex', gap: '6px' }}>
              {isEditing ? (
                <>
                  <button 
                    type="button"
                    className="mini-icon-btn" 
                    onClick={() => {
                      onSave(draft);
                      setIsEditing(false);
                    }}
                    style={{ 
                      fontSize: '10px', 
                      padding: '2px 8px', 
                      background: 'rgba(16, 185, 129, 0.15)', 
                      color: '#10b981', 
                      borderColor: 'rgba(16, 185, 129, 0.3)',
                      height: '20px'
                    }}
                  >
                    Save
                  </button>
                  <button 
                    type="button"
                    className="mini-icon-btn" 
                    onClick={() => {
                      setDraft(content);
                      setIsEditing(false);
                    }}
                    style={{ 
                      fontSize: '10px', 
                      padding: '2px 8px', 
                      background: 'rgba(239, 68, 68, 0.15)', 
                      color: '#ef4444', 
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                      height: '20px'
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button 
                  type="button"
                  className="mini-icon-btn flex-align" 
                  onClick={() => setIsEditing(true)}
                  style={{ 
                    fontSize: '10px', 
                    padding: '2px 6px', 
                    gap: '4px',
                    background: 'rgba(255, 255, 255, 0.05)', 
                    color: 'var(--text-secondary)',
                    height: '20px'
                  }}
                >
                  <Edit2 size={10} /> Edit
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isEditing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{
            width: '100%',
            minHeight: '140px',
            background: 'var(--bg-dark)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-glass)',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            lineHeight: 1.4,
            resize: 'vertical',
            flex: 1
          }}
        />
      ) : (
        <div style={{ flex: 1 }}>
          {lines.map((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={idx} style={{ height: '4px' }} />;

            if (line.startsWith('# ')) {
              return (
                <h3 key={idx} style={{ fontSize: '14px', fontWeight: 700, margin: '12px 0 6px 0', color: 'var(--text-primary)' }}>
                  {parseInlineMarkdown(line.substring(2))}
                </h3>
              );
            }
            if (line.startsWith('## ')) {
              return (
                <h4 key={idx} style={{ fontSize: '13px', fontWeight: 600, margin: '10px 0 4px 0', color: 'var(--text-primary)' }}>
                  {parseInlineMarkdown(line.substring(3))}
                </h4>
              );
            }
            if (line.startsWith('### ')) {
              return (
                <h5 key={idx} style={{ fontSize: '12px', fontWeight: 600, margin: '8px 0 2px 0', color: 'var(--text-primary)' }}>
                  {parseInlineMarkdown(line.substring(4))}
                </h5>
              );
            }
            if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
              const contentText = line.startsWith('- ') || line.startsWith('* ') ? line.substring(2) : line.substring(1);
              return (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '6px', 
                    margin: '4px 0', 
                    paddingLeft: '6px',
                    lineHeight: 1.4
                  }}
                >
                  <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>•</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {parseInlineMarkdown(contentText)}
                  </span>
                </div>
              );
            }

            return (
              <p key={idx} style={{ margin: '4px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {parseInlineMarkdown(line)}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
