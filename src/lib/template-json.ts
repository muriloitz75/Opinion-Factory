import { normalizeMarkdown } from './markdown-normalizer';

export type TemplateJsonBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

export interface TemplateJsonDocument {
  blocks: TemplateJsonBlock[];
}

const VARIABLE_REGEX = /{{(.*?)}}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toInlineHtml(value: string): string {
  const escaped = escapeHtml(value).replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1');
  return escaped
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br />');
}

export function blockTextToHtml(text: string): string {
  return toInlineHtml(text);
}

export function markdownToTemplateJson(markdown: string): TemplateJsonDocument {
  const lines = normalizeMarkdown(markdown).split('\n');
  const blocks: TemplateJsonBlock[] = [];
  const paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    const text = paragraphBuffer.join('').trim();
    if (text.length > 0) {
      blocks.push({ type: 'paragraph', text });
    }
    paragraphBuffer.length = 0;
  };

  const appendParagraphLine = (line: string) => {
    const trimmedRight = line.replace(/\s+$/, '');
    const hasHardBreak = / {2,}$/.test(line) || /\\$/.test(trimmedRight);
    const cleaned = trimmedRight.replace(/\\$/, '').trim();
    if (!cleaned) return;
    paragraphBuffer.push(cleaned);
    paragraphBuffer.push(hasHardBreak ? '\n' : ' ');
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: 'heading', level, text: headingMatch[2].trim() });
      i += 1;
      continue;
    }

    const numberedBoldSectionMatch = line.match(/^\s*(\d+)\.\s+\*\*([^*\n]+)\*\*\s*$/);
    if (numberedBoldSectionMatch) {
      flushParagraph();
      blocks.push({ type: 'heading', level: 2, text: `${numberedBoldSectionMatch[1]}. ${numberedBoldSectionMatch[2].trim()}` });
      i += 1;
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];
      while (i < lines.length) {
        const currentLine = lines[i];
        const itemMatch = ordered
          ? currentLine.match(/^\s*\d+[.)]\s+(.+)$/)
          : currentLine.match(/^\s*[-*+]\s+(.+)$/);
        if (!itemMatch) break;
        let itemText = itemMatch[1].trim();
        let j = i + 1;
        while (j < lines.length) {
          const continuation = lines[j];
          if (!continuation.trim()) break;
          if (/^\s{2,}\S+/.test(continuation)) {
            itemText += ` ${continuation.trim()}`;
            j += 1;
            continue;
          }
          break;
        }
        items.push(itemText);
        i = j;
      }
      if (items.length > 0) {
        blocks.push({ type: 'list', ordered, items });
      }
      continue;
    }

    appendParagraphLine(line);
    i += 1;
  }

  flushParagraph();
  return { blocks };
}

function collectVariables(text: string, variables: Set<string>) {
  const matches = text.matchAll(VARIABLE_REGEX);
  for (const match of matches) {
    variables.add(match[1].trim());
  }
}

function replaceVariableText(text: string, values: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || `{{${key}}}`);
  }
  return result;
}

export function extractVariablesFromTemplateJson(document: TemplateJsonDocument): string[] {
  const variables = new Set<string>();
  document.blocks.forEach(block => {
    if (block.type === 'list') {
      block.items.forEach(item => collectVariables(item, variables));
      return;
    }
    collectVariables(block.text, variables);
  });
  return Array.from(variables);
}

export function replaceVariablesInTemplateJson(document: TemplateJsonDocument, values: Record<string, string>): TemplateJsonDocument {
  return {
    blocks: document.blocks.map(block => {
      if (block.type === 'list') {
        return {
          ...block,
          items: block.items.map(item => replaceVariableText(item, values))
        };
      }
      return {
        ...block,
        text: replaceVariableText(block.text, values)
      };
    })
  };
}
