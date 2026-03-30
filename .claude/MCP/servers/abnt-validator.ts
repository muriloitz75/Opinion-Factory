/**
 * MCP Server: abnt-validator
 * Expõe regras de conformidade ABNT como ferramentas de validação.
 * Transporte: stdio
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

const ROOT      = path.resolve(import.meta.dirname, '../../../');
const DOCS_PATH = path.join(ROOT, 'Docs');

// ── Especificação ABNT ───────────────────────────────────────

const ABNT_SPEC = {
  typography:  { font: 'Times New Roman', sizePt: 12, lineSpacing: 1.5, lineSpacingTwips: 360 },
  margins:     { topCm: 3, leftCm: 3, rightCm: 2, bottomCm: 2 },
  indentation: { firstLineCm: 1.25, firstLineTwips: 709 },
  blockTypes: {
    title:    { alignment: 'center',    bold: true,  indent: false, cssClass: 'abnt-centered font-bold abnt-parecer' },
    metadata: { alignment: 'left',      bold: false, indent: false, cssClass: 'abnt-no-indent abnt-left' },
    date:     { alignment: 'right',     bold: false, indent: false, cssClass: 'abnt-right abnt-data-block' },
    section:  { alignment: 'left',      bold: true,  indent: false, cssClass: '' },
    body:     { alignment: 'justified', bold: false, indent: true,  cssClass: '' },
    closing:  { alignment: 'left',      bold: false, indent: false, cssClass: 'abnt-no-indent abnt-closing' },
  },
};

const PATTERNS = {
  parecer:  /^PARECER\b/i,
  metadata: /^(PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ|N[Oº°][.º°]?\s|REF(?:ERÊNCIA)?[:\s]|AUTOS|ENDEREÇO|INSCRIÇÃO|VISTORIA)\b/i,
  date:     /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,25},\s*(\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+\s+de\s+\d{4}|\{\{[^}]+\}\})/i,
  heading:  /^\s{0,3}#{1,6} /,
  fecho:    /submeto à douta consideração superior/i,
  listItem: /^\s*[-*+] |\s*\d+[.)]\s+\S/,
};

const ISOLATED = new Set(['heading', 'parecer', 'metadata', 'date', 'fecho']);

function classifyLine(line: string): string {
  const p = line.trim();
  if (!p) return 'empty';
  if (PATTERNS.heading.test(line)) return 'heading';
  if (PATTERNS.parecer.test(p))    return 'parecer';
  if (PATTERNS.metadata.test(p))   return 'metadata';
  if (PATTERNS.date.test(p))       return 'date';
  if (PATTERNS.fecho.test(p))      return 'fecho';
  if (PATTERNS.listItem.test(line))return 'list-item';
  return 'body';
}

function validateStructure(content: string) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const violations: object[] = [];
  for (let i = 0; i < lines.length; i++) {
    const type = classifyLine(lines[i]);
    if (!ISOLATED.has(type)) continue;
    const prev = i > 0 ? lines[i - 1] : null;
    const next = i < lines.length - 1 ? lines[i + 1] : null;
    if (prev !== null && prev.trim() !== '' && i > 0)
      violations.push({ line: i + 1, rule: 'block-isolation', message: `"${type}" precisa de linha em branco antes. Encontrado: "${prev.slice(0, 40)}"`, severity: 'error' });
    if (next !== null && next.trim() !== '')
      violations.push({ line: i + 1, rule: 'block-isolation', message: `"${type}" precisa de linha em branco depois. Encontrado: "${next.slice(0, 40)}"`, severity: 'error' });
  }
  return { valid: violations.length === 0, violations };
}

function validateVarNames(content: string) {
  const issues: object[] = [];
  for (const m of content.matchAll(/\{\{([^}]+)\}\}/g)) {
    const name = m[1].trim();
    if (/\s/.test(name))
      issues.push({ variable: name, severity: 'error',   issue: `Espaço no nome — use camelCase: {{${name.replace(/\s+(.)/g, (_, c) => c.toUpperCase())}}}` });
    else if (/_/.test(name))
      issues.push({ variable: name, severity: 'warning', issue: `snake_case — prefira camelCase: {{${name.replace(/_(.)/g, (_, c) => c.toUpperCase())}}}` });
    else if (/[À-ÿ]/.test(name))
      issues.push({ variable: name, severity: 'warning', issue: 'Nome com acentos — pode causar problemas de codificação' });
  }
  return { valid: issues.filter((i) => (i as { severity: string }).severity === 'error').length === 0, issues };
}

// ── Servidor ─────────────────────────────────────────────────

const server = new Server(
  { name: 'abnt-validator', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'validate_markdown_structure',
      description: 'Verifica isolamento de blocos ABNT (PARECER, metadata, data, fecho, headings).',
      inputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' } } },
    },
    {
      name: 'validate_variable_names',
      description: 'Audita nomes de variáveis {{x}} quanto às convenções camelCase do projeto.',
      inputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' } } },
    },
    {
      name: 'classify_block',
      description: 'Classifica semanticamente uma linha de Markdown.',
      inputSchema: { type: 'object', required: ['line'], properties: { line: { type: 'string' } } },
    },
    {
      name: 'validate_html_blocks',
      description: 'Verifica se blocos legais no HTML têm classes CSS ABNT corretas.',
      inputSchema: { type: 'object', required: ['html'], properties: { html: { type: 'string' } } },
    },
    {
      name: 'get_abnt_spec',
      description: 'Retorna a especificação ABNT completa do projeto.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'audit_all_templates',
      description: 'Valida todos os templates .md de Docs/ e retorna relatório consolidado.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;
  const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 2) }] });

  switch (name) {
    case 'validate_markdown_structure': return text(validateStructure((a as { content: string }).content));
    case 'validate_variable_names':     return text(validateVarNames((a as { content: string }).content));

    case 'classify_block': {
      const { line } = a as { line: string };
      const type = classifyLine(line);
      return text({ type, isolated: ISOLATED.has(type), abntSpec: (ABNT_SPEC.blockTypes as Record<string, unknown>)[type] ?? null });
    }

    case 'validate_html_blocks': {
      const { html } = a as { html: string };
      const violations: object[] = [];
      for (const m of html.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/gi)) {
        const attrs = m[1], text2 = m[2].replace(/<[^>]+>/g, '').trim();
        if (PATTERNS.parecer.test(text2) && text2.length < 30 && !attrs.includes('abnt-centered'))
          violations.push({ text: text2, expected: 'abnt-centered', found: attrs || 'sem classe' });
        if (PATTERNS.metadata.test(text2) && !attrs.includes('abnt-no-indent'))
          violations.push({ text: text2.slice(0, 40), expected: 'abnt-no-indent', found: attrs || 'sem classe' });
        if (PATTERNS.fecho.test(text2) && !attrs.includes('abnt-closing'))
          violations.push({ text: text2.slice(0, 40), expected: 'abnt-closing', found: attrs || 'sem classe' });
      }
      return text({ valid: violations.length === 0, violations });
    }

    case 'get_abnt_spec': return text(ABNT_SPEC);

    case 'audit_all_templates': {
      const files = (await fs.readdir(DOCS_PATH).catch(() => [])).filter(f => f.endsWith('.md'));
      const results = await Promise.all(files.map(async (file) => {
        const content = await fs.readFile(path.join(DOCS_PATH, file), 'utf-8');
        const s = validateStructure(content);
        const v = validateVarNames(content);
        return { filename: file, valid: s.valid && v.valid, violations: [...s.violations, ...v.issues] };
      }));
      return text({ summary: { total: results.length, valid: results.filter(r => r.valid).length, withErrors: results.filter(r => !r.valid).length }, results });
    }

    default: throw new Error(`Tool desconhecida: ${name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: 'abnt://spec',           name: 'Especificação ABNT',  mimeType: 'application/json' },
    { uri: 'abnt://block-patterns', name: 'Padrões de bloco',    mimeType: 'application/json' },
    { uri: 'abnt://css-classes',    name: 'Classes CSS por tipo', mimeType: 'application/json' },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const { uri } = req.params;
  const map: Record<string, unknown> = {
    'abnt://spec':           ABNT_SPEC,
    'abnt://block-patterns': Object.fromEntries(Object.entries(PATTERNS).map(([k, v]) => [k, v.toString()])),
    'abnt://css-classes':    Object.fromEntries(Object.entries(ABNT_SPEC.blockTypes).map(([k, v]) => [k, (v as { cssClass: string }).cssClass])),
  };
  if (uri in map) return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(map[uri], null, 2) }] };
  throw new Error(`Resource desconhecido: ${uri}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
