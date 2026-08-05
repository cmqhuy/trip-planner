import React, { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';
import { formatFreshness } from '../constants/aiFieldIcons';

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
        <code key={index} className="ai-md-code">
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
            className="ai-md-link"
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
    <div className={className} style={style}>
      {showHeader && (
        <div className="ai-md-header">
          <div className="ai-md-title-row">
            {title && title}
            {updatedAt !== undefined && updatedAt > 0 && (
              <div className="text-muted-xs">
                Updated: {formatFreshness(updatedAt)}
              </div>
            )}
          </div>
          {onSave && canEdit && (
            <div className="ai-md-actions">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="mini-icon-btn ai-md-save-btn"
                    onClick={() => {
                      onSave(draft);
                      setIsEditing(false);
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="mini-icon-btn ai-md-cancel-btn"
                    onClick={() => {
                      setDraft(content);
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="mini-icon-btn flex-align ai-markdown-edit-btn"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 size={10} /> <span className="btn-text">Edit</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isEditing ? (
        <textarea
          className="ai-md-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : (
        <div className="ai-md-content">
          {lines.map((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={idx} className="ai-md-spacer" />;

            if (line.startsWith('# ')) {
              return (
                <h3 key={idx} className="ai-md-h1">
                  {parseInlineMarkdown(line.substring(2))}
                </h3>
              );
            }
            if (line.startsWith('## ')) {
              return (
                <h4 key={idx} className="ai-md-h2">
                  {parseInlineMarkdown(line.substring(3))}
                </h4>
              );
            }
            if (line.startsWith('### ')) {
              return (
                <h5 key={idx} className="ai-md-h3">
                  {parseInlineMarkdown(line.substring(4))}
                </h5>
              );
            }

            const numberedMatch = trimmed.match(/^(\d+[.)])\s+(.*)/);
            if (numberedMatch) {
              const isIndented = line.search(/\S/) > 0;
              return (
                <div key={idx} className="ai-md-list-item" style={{ paddingLeft: isIndented ? '18px' : '6px' }}>
                  <span className="text-accent flex-shrink-0" style={{ fontSize: '11px', fontWeight: 600 }}>{numberedMatch[1]}</span>
                  <span className="ai-md-item-text">
                    {parseInlineMarkdown(numberedMatch[2])}
                  </span>
                </div>
              );
            }

            if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
              const isIndented = line.search(/\S/) > 0;
              const contentText = trimmed.startsWith('- ') || trimmed.startsWith('* ') ? trimmed.substring(2) : trimmed.substring(1);
              return (
                <div key={idx} className="ai-md-list-item" style={{ paddingLeft: isIndented ? '18px' : '6px' }}>
                  <span className="text-accent flex-shrink-0">•</span>
                  <span className="ai-md-item-text">
                    {parseInlineMarkdown(contentText)}
                  </span>
                </div>
              );
            }

            return (
              <p key={idx} className="ai-md-para">
                {parseInlineMarkdown(line)}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
