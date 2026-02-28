import { MouseEvent, useState } from 'react';
import { Event } from '../types/api';

type SnippetPlatform = 'ios' | 'android';
type SnippetTab = 'code' | 'prompt';

interface EventSnippetViewerProps {
  event: Event;
  platform: SnippetPlatform;
  onClose: () => void;
  onCopySuccess: (message: string) => void;
  onCopyError: (message: string) => void;
}

const platformMeta: Record<SnippetPlatform, { label: string; language: string; badgeClass: string }> = {
  ios: {
    label: 'iOS',
    language: 'Swift',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200'
  },
  android: {
    label: 'Android',
    language: 'Kotlin',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  }
};

const quoteForStringLiteral = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const getExampleForDataType = (dataType: string, exampleValue: string | null | undefined): string => {
  if (exampleValue && exampleValue.trim().length > 0) {
    return exampleValue.trim();
  }

  const normalized = dataType.toLowerCase();
  if (normalized.includes('int') || normalized.includes('double') || normalized.includes('float') || normalized.includes('number')) {
    return '1';
  }
  if (normalized.includes('bool')) {
    return 'true';
  }
  return 'value';
};

const formatValueForPrompt = (dataType: string, value: string): string => {
  const normalized = dataType.toLowerCase();
  if (normalized.includes('bool')) {
    return value.toLowerCase() === 'true' ? 'true' : 'false';
  }
  if (normalized.includes('int') || normalized.includes('double') || normalized.includes('float') || normalized.includes('number')) {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? value : `${numericValue}`;
  }
  return `"${quoteForStringLiteral(value)}"`;
};

const toSwiftPropertyValue = (dataType: string, value: string): string => {
  const normalized = dataType.toLowerCase();
  if (normalized.includes('bool')) {
    return value.toLowerCase() === 'true' ? 'true' : 'false';
  }
  if (normalized.includes('int') || normalized.includes('double') || normalized.includes('float') || normalized.includes('number')) {
    return Number.isNaN(Number(value)) ? '0' : value;
  }
  return `"${quoteForStringLiteral(value)}"`;
};

const toKotlinPropertyValue = (dataType: string, value: string): string => {
  const normalized = dataType.toLowerCase();
  if (normalized.includes('bool')) {
    return value.toLowerCase() === 'true' ? 'true' : 'false';
  }
  if (normalized.includes('int')) {
    return Number.isNaN(Number(value)) ? '0' : `${parseInt(value, 10)}`;
  }
  if (normalized.includes('double') || normalized.includes('float') || normalized.includes('number')) {
    return Number.isNaN(Number(value)) ? '0.0' : `${Number(value)}`;
  }
  return `"${quoteForStringLiteral(value)}"`;
};

const buildIosSnippet = (event: Event): string => {
  const propertiesLines = event.properties.map((prop) => {
    const value = getExampleForDataType(prop.data_type, prop.example_value);
    return `    "${quoteForStringLiteral(prop.property_name)}": ${toSwiftPropertyValue(prop.data_type, value)}`;
  });

  const propertiesBlock = propertiesLines.length > 0
    ? `[\n${propertiesLines.join(',\n')}\n]`
    : '[:]';

  return `// Segment iOS (Analytics-Swift)
Analytics.shared.track(name: "${quoteForStringLiteral(event.name)}", properties: ${propertiesBlock})`;
};

const buildAndroidSnippet = (event: Event): string => {
  const propertyCalls = event.properties.map((prop) => {
    const value = getExampleForDataType(prop.data_type, prop.example_value);
    return `    .putValue("${quoteForStringLiteral(prop.property_name)}", ${toKotlinPropertyValue(prop.data_type, value)})`;
  });

  const propertiesBlock = propertyCalls.length > 0
    ? `Properties()\n${propertyCalls.join('\n')}`
    : 'Properties()';

  return `// Segment Android
analytics.track("${quoteForStringLiteral(event.name)}", ${propertiesBlock})`;
};

const buildCodingAgentPrompt = (event: Event, platform: SnippetPlatform): string => {
  const meta = platformMeta[platform];
  const propertyLines = event.properties.length > 0
    ? event.properties.map((prop) => {
      const value = getExampleForDataType(prop.data_type, prop.example_value);
      return `- \`${prop.property_name}\` | scope: \`${prop.property_type}\` | type: \`${prop.data_type}\` | required: \`${prop.is_required ? 'yes' : 'no'}\` | example: \`${formatValueForPrompt(prop.data_type, value)}\``;
    }).join('\n')
    : '- No properties are defined for this event.';

  return `You are updating an existing ${meta.label} codebase to add one analytics event.

Workflow
1. Read any applicable instruction files before coding: nearest \`AGENTS.md\`, \`CLAUDE.md\`, \`GEMINI.md\`, \`.github/copilot-instructions.md\`, \`.cursorrules\`, \`cursor.md\`, or similar repo guidance if present.
2. Search the repository for the existing analytics wrapper, similar tracked events, shared property builders, validation utilities, and tests.
3. Reuse the established ${meta.language} pattern. Do not invent a parallel analytics abstraction unless the repository clearly has none.
4. Make the smallest production-ready change that satisfies the event spec, then do one verification pass and one self-review pass.

Task
- Platform: \`${meta.label}\`
- Language: \`${meta.language}\`
- Event name: \`${event.name}\`
- Description: \`${event.description || 'No description provided'}\`
- Category: \`${event.category || 'Uncategorized'}\`

Event spec
${propertyLines}

Implementation rules
- Use the exact event name \`${event.name}\`.
- Do not rename, remove, or invent properties.
- Preserve the declared property types.
- Treat required properties as mandatory at the call site.
- Only send optional properties when a value exists.
- Match the repository's existing patterns for analytics calls, threading, nullability/optionals, and error handling.
- Consider ripple effects across callers, wrappers, and tests before editing.
- Prioritize correctness, edge cases, and regressions over style nits or broad refactors.
- If the existing codebase pattern conflicts with this event spec, follow the event spec and call out the conflict explicitly.

Verification
- Run the smallest relevant verification available for the touched code: targeted tests, build step, lint, or typecheck.
- If full verification is too expensive, run the narrowest meaningful command and say what was not run.
- Self-review the final diff for missing imports, bad types, optional handling mistakes, duplicate logic, and inconsistent analytics usage.

Response format
- Brief summary of what changed
- Files changed
- Verification performed
- Assumptions or open questions
- Minimal diff or final code edits only`;
};

const copyToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  throw new Error('Clipboard API unavailable');
};

export default function EventSnippetViewer({
  event,
  platform,
  onClose,
  onCopySuccess,
  onCopyError
}: EventSnippetViewerProps) {
  const [activeTab, setActiveTab] = useState<SnippetTab>('code');
  const meta = platformMeta[platform];
  const codeSnippet = platform === 'ios' ? buildIosSnippet(event) : buildAndroidSnippet(event);
  const codingAgentPrompt = buildCodingAgentPrompt(event, platform);
  const activeContent = activeTab === 'code' ? codeSnippet : codingAgentPrompt;
  const activeLabel = activeTab === 'code' ? `${meta.label} code snippet` : `${meta.label} coding agent prompt`;

  const handleCopy = async () => {
    try {
      await copyToClipboard(activeContent);
      onCopySuccess(`Copied ${activeLabel} for ${event.name}`);
    } catch (error) {
      console.error('Failed to copy snippet viewer content:', error);
      onCopyError(`Failed to copy ${activeLabel}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-strong overflow-hidden animate-scale-in">
        <div className="border-b border-border bg-card/95 px-5 py-4 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                  {meta.label} Implementation
                </h2>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] ${meta.badgeClass}`}>
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-foreground/90 truncate">
                {event.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {event.description || 'Review the generated content below, then copy or select what you need.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close snippet viewer"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/40 p-1 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === 'code'
                    ? 'bg-card text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Code snippet
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('prompt')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === 'prompt'
                    ? 'bg-card text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Coding agent prompt
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <p className="text-[11px] text-muted-foreground">
                Select text directly or use the copy control.
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={`Copy ${activeLabel}`}
                aria-label={`Copy ${activeLabel}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/60 bg-background">
            <textarea
              readOnly
              spellCheck={false}
              value={activeContent}
              aria-label={`${activeLabel} content`}
              className="min-h-[360px] w-full resize-none rounded-xl bg-transparent px-4 py-4 font-mono text-[12px] leading-6 text-foreground outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
