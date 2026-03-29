/**
 * MCP Server: docx-processor
 * Expõe o pipeline de processamento de documentos do Opinion Factory.
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
import { normalizeMarkdown, isMarkdownNormalized } from '../../../src/lib/markdown-normalizer.js';
import { markdownToTemplateJson, replaceVariablesInTemplateJson } from '../../../src/lib/template-json.js';
import { markdownToHtml, extractVariablesFromMarkdown, markdownToDocxBuffer } from '../../../src/lib/template-markdown.js';
import { extractVariablesFromDocx, docxToHtml } from '../../../src/lib/template-docx.js';
import { normalizeDocumentHtml } from '../../../src/lib/html-normalize.js';

const ROOT       = path.resolve(import.meta.dirname, '../../../');
const DOCS_PATH  = path.join(ROOT, 'Docs');
const MODEL_PATH = path.join(ROOT, 'model', 'modelo.docx');

const server = new Server(
  { name: 'docx-processor', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'extract_variables',
      description: 'Extrai variáveis {{x}} de um template (.md ou .docx).',
      inputSchema: { type: 'object', required: ['filename'], properties: { filename: { type: 'string' } } },
    },
    {
      name: 'render_preview',
      description: 'Executa o pipeline de pré-visualização e retorna HTML ABNT normalizado.',
      inputSchema: {
        type: 'object', required: ['filename'],
        properties: {
          filename: { type: 'string' },
          values:   { type: 'object', additionalProperties: { type: 'string' }, default: {} },
        },
      },
    },
    {
      name: 'normalize_markdown',
      description: 'Aplica normalização ABNT a um conteúdo Markdown sem salvar.',
      inputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' } } },
    },
    {
      name: 'normalize_html',
      description: 'Aplica normalizeDocumentHtml() e retorna HTML normalizado.',
      inputSchema: { type: 'object', required: ['html'], properties: { html: { type: 'string' } } },
    },
    {
      name: 'trace_pipeline',
      description: 'Executa o pipeline Markdown→DOCX etapa a etapa para diagnóstico.',
      inputSchema: {
        type: 'object', required: ['filename'],
        properties: {
          filename: { type: 'string', description: 'Deve ser arquivo .md' },
          values:   { type: 'object', additionalProperties: { type: 'string' }, default: {} },
        },
      },
    },
    {
      name: 'generate_docx',
      description: 'Gera DOCX final a partir de um template e valores de variáveis.',
      inputSchema: {
        type: 'object', required: ['filename'],
        properties: {
          filename: { type: 'string' },
          values:   { type: 'object', additionalProperties: { type: 'string' }, default: {} },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;
  const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 2) }] });

  switch (name) {

    case 'extract_variables': {
      const { filename } = a as { filename: string };
      const buf = await fs.readFile(path.join(DOCS_PATH, filename));
      const variables = filename.endsWith('.md')
        ? extractVariablesFromMarkdown(buf.toString('utf-8'))
        : extractVariablesFromDocx(buf);
      return text({ variables });
    }

    case 'render_preview': {
      const { filename, values = {} } = a as { filename: string; values: Record<string, string> };
      const start = Date.now();
      const buf = await fs.readFile(path.join(DOCS_PATH, filename));
      let html: string;
      if (filename.endsWith('.md')) {
        html = markdownToHtml(buf.toString('utf-8'), values);
      } else {
        html = await docxToHtml(buf, values);
      }
      return text({ html, durationMs: Date.now() - start });
    }

    case 'normalize_markdown': {
      const { content } = a as { content: string };
      return text({
        normalized: normalizeMarkdown(content),
        wasAlreadyNormal: isMarkdownNormalized(content),
      });
    }

    case 'normalize_html': {
      const { html } = a as { html: string };
      return text({ normalized: normalizeDocumentHtml(html), original: html });
    }

    case 'trace_pipeline': {
      const { filename, values = {} } = a as { filename: string; values: Record<string, string> };
      if (!filename.endsWith('.md')) throw new Error('trace_pipeline suporta apenas .md');

      const raw        = await fs.readFile(path.join(DOCS_PATH, filename), 'utf-8');
      const normalized = normalizeMarkdown(raw);
      const json       = markdownToTemplateJson(normalized);
      const filled     = replaceVariablesInTemplateJson(json, values);
      const docxBuf    = await markdownToDocxBuffer(normalized, values);
      const modelOk    = await fs.access(MODEL_PATH).then(() => true).catch(() => false);

      return text({
        filename,
        steps: [
          { step: 'normalizeMarkdown',             output: normalized.slice(0, 120) + '…' },
          { step: 'markdownToTemplateJson',         output: `${json.blocks.length} blocos` },
          { step: 'replaceVariablesInTemplateJson', output: `${filled.blocks.length} blocos com valores substituídos` },
          { step: 'markdownToDocxBuffer',           output: `Buffer(${docxBuf.length} bytes), ZIP válido: ${docxBuf[0] === 0x50 && docxBuf[1] === 0x4B}` },
          { step: 'applyMasterEnvelope',            output: modelOk ? `modelo.docx presente em ${MODEL_PATH}` : 'modelo.docx ausente — usará conteúdo puro (fallback)' },
        ],
      });
    }

    case 'generate_docx': {
      const { filename, values = {} } = a as { filename: string; values: Record<string, string> };
      const start = Date.now();
      const buf = await fs.readFile(path.join(DOCS_PATH, filename));

      let contentBuf: Buffer;
      if (filename.endsWith('.md')) {
        contentBuf = await markdownToDocxBuffer(buf.toString('utf-8'), values);
      } else {
        const PizZip = (await import('pizzip')).default;
        const Docxtemplater = (await import('docxtemplater')).default;
        const zip = new PizZip(buf);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
        doc.render(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ?? ''])));
        contentBuf = doc.getZip().generate({ type: 'nodebuffer' });
      }

      return text({
        sizeBytes: contentBuf.length,
        zipMagic: contentBuf[0] === 0x50 && contentBuf[1] === 0x4B,
        durationMs: Date.now() - start,
        note: 'Envelope mestre não aplicado neste modo — use a UI para o download final',
      });
    }

    default: throw new Error(`Tool desconhecida: ${name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: 'pipeline://health', name: 'Status do pipeline', mimeType: 'application/json' },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const { uri } = req.params;
  if (uri === 'pipeline://health') {
    const modelOk = await fs.access(MODEL_PATH).then(() => true).catch(() => false);
    const docsOk  = await fs.access(DOCS_PATH).then(() => true).catch(() => false);
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ modelDocx: modelOk, docsFolder: docsOk, status: modelOk && docsOk ? 'healthy' : 'degraded' }) }] };
  }
  throw new Error(`Resource desconhecido: ${uri}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
