import { useState, useEffect } from 'react';

interface PrdPanelProps {
  prdContent: string;
  onUpdate: (content: string) => void;
  disabled?: boolean;
}

export default function PrdPanel({ prdContent, onUpdate, disabled = false }: PrdPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [localContent, setLocalContent] = useState(prdContent);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalContent(prdContent);
    setHasChanges(false);
  }, [prdContent]);

  const handleSave = () => {
    if (localContent !== prdContent) {
      onUpdate(localContent);
      setHasChanges(false);
    }
  };

  const handleChange = (value: string) => {
    setLocalContent(value);
    setHasChanges(value !== prdContent);
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-lg font-semibold text-foreground">PRD Content</h2>
          {localContent && (
            <span className="text-xs text-muted-foreground">
              {localContent.length} characters
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && !disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Save
            </button>
          )}
          <svg
            className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border p-4">
          {disabled ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {localContent ? (
                <pre className="whitespace-pre-wrap text-sm text-foreground bg-muted/30 p-4 rounded">
                  {localContent}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic">No PRD content provided</p>
              )}
            </div>
          ) : (
            <div>
              <textarea
                value={localContent}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleSave}
                placeholder="Paste your PRD content here..."
                className="w-full min-h-[200px] px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Paste the Product Requirements Document text here. This will be used for LLM-based event generation.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
