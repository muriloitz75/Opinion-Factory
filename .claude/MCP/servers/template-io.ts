/**
 * MCP Server: template-io
 * Gerencia templates em Docs/ e importação via Google Docs.
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
import { extractVariablesFromDocx } from '../../../src/lib/template-docx.js';
import { extractVariablesFromMarkdown } from '../../../src/lib/template-markdown.js';

const ROOT      = path.resolve(import.meta.dirname, '../../../');
const DOCS_PATH = path.join(ROOT, 'Docs');
const MODEL_PATH = path.join(ROOT, 'model', 'modelo.docx');
const SUPPORTED = ['.md', '.docx'] as const;

async function listTemplateFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(DOCS_PATH);
    return files.filter(f => SUPPORTED.some(ext => f.endsWith(ext)));
  } catch { return []; }
}

const server = new Server(
  { name: 'template-io', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_templates',
      description: 'Lista todos os templates em Docs/ com metadados (nome, tipo, variáveis, tamanho).',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'read_template',
      description: 'Lê o conteúdo bruto de um template .md.',
      inputSchema: {
        type: 'object', required: ['filename'],
        properties: { filename: { type: 'string' } },
      },
    },
    {
      name: 'create_template',
      description: 'Cria um template Markdown em Docs/. Aplica normalização ABNT automaticamente.',
      inputSchema: {
        type: 'object', required: ['filename', 'content'],
        properties: {
          filename: { type: 'string' },
          content:  { type: 'string' },
        },
      },
    },
    {
      name: 'delete_template',
      description: 'Remove um template de Docs/.',
      inputSchema: {
        type: 'object', required: ['filename'],
        properties: { filename: { type: 'string' } },
      },
    },
    {
      name: 'import_from_google_docs',
      description: 'Importa documento público do Google Docs como DOCX e salva em Docs/.',
      inputSchema: {
        type: 'object', required: ['url'],
        properties: { url: { type: 'string' } },
      },
    },
    {
      name: 'normalize_template',
      description: 'Aplica normalização ABNT estrita a um template Markdown e salva.',
      inputSchema: {
        type: 'object', required: ['filename'],
        properties: { filename: { type: 'string' } },
      },
    },
    {
      name: 'read_master_model',
      description: 'Retorna metadados do arquivo mestre model/modelo.docx.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;

  const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 2) }] });

  switch (name) {

    case 'list_templates': {
      const files = await listTemplateFiles();
      const templates = await Promise.all(files.map(async (file) => {
        try {
          const buf  = await fs.readFile(path.join(DOCS_PATH, file));
          const stat = await fs.stat(path.join(DOCS_PATH, file));
          const ext  = path.extname(file);
          const variables = ext === '.md'
            ? extractVariablesFromMarkdown(buf.toString('utf-8'))
            : extractVariablesFromDocx(buf);
          return { name: file.replace(/\.(md|docx)$/i, ''), filename: file, type: ext === '.md' ? 'markdown' : 'docx', variables, sizeBytes: stat.size };
        } catch { return null; }
      }));
      return text(templates.filter(Boolean));
    }

    case 'read_template': {
      const { filename } = a as { filename: string };
      const ext = path.extname(filename);
      if (!SUPPORTED.some(s => s === ext)) throw new Error(`Extensão não suportada: ${ext}`);
      const buf = await fs.readFile(path.join(DOCS_PATH, filename));
      const content = ext === '.md' ? buf.toString('utf-8') : `[DOCX binário — ${buf.length} bytes]`;
      return text({ content, type: ext === '.md' ? 'markdown' : 'docx' });
    }

    case 'create_template': {
      const { filename, content } = a as { filename: string; content: string };
      if (!filename.endsWith('.md')) throw new Error('Suporta apenas .md');
      const normalized = normalizeMarkdown(content);
      await fs.writeFile(path.join(DOCS_PATH, filename), normalized, 'utf-8');
      return text({ success: true, normalizedContent: normalized });
    }

    case 'delete_template': {
      const { filename } = a as { filename: string };
      if (!SUPPORTED.some(ext => filename.endsWith(ext))) return text({ success: false, error: 'Extensão não suportada' });
      try {
        await fs.unlink(path.join(DOCS_PATH, filename));
        return text({ success: true });
      } catch { return text({ success: false, error: 'Arquivo não encontrado' }); }
    }

    case 'import_from_google_docs': {
      const { url } = a as { url: string };
      const idMatch = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)\//);
      if (!idMatch) throw new Error('URL inválida — ID do documento não encontrado');
      const docId = idMatch[1];
      const res = await fetch(`https://docs.google.com/document/d/${docId}/export?format=docx`, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} — verifique se o documento é público`);
      const disposition = res.headers.get('content-disposition') ?? '';
      const nameMatch = disposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
      const filename = nameMatch ? nameMatch[1].replace(/[^a-z0-9.\- ]/gi, '').trim() || `gdoc-${docId}.docx` : `gdoc-${docId}.docx`;
      await fs.writeFile(path.join(DOCS_PATH, filename), Buffer.from(await res.arrayBuffer()));
      return text({ success: true, filename });
    }

    case 'normalize_template': {
      const { filename } = a as { filename: string };
      if (!filename.endsWith('.md')) throw new Error('Suporta apenas .md');
      const original = await fs.readFile(path.join(DOCS_PATH, filename), 'utf-8');
      const alreadyNormalized = isMarkdownNormalized(original);
      const normalized = normalizeMarkdown(original);
      if (!alreadyNormalized) await fs.writeFile(path.join(DOCS_PATH, filename), normalized, 'utf-8');
      return text({ alreadyNormalized, normalizedContent: normalized });
    }

    case 'read_master_model': {
      try {
        const stat = await fs.stat(MODEL_PATH);
        return text({ exists: true, sizeBytes: stat.size, path: MODEL_PATH });
      } catch { return text({ exists: false, path: MODEL_PATH }); }
    }

    default: throw new Error(`Tool desconhecida: ${name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: 'docs://templates', name: 'Lista de templates', mimeType: 'application/json' },
    { uri: 'docs://model',     name: 'Template mestre',   mimeType: 'application/json' },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const { uri } = req.params;
  if (uri === 'docs://templates') {
    const files = await listTemplateFiles();
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(files) }] };
  }
  if (uri === 'docs://model') {
    const exists = await fs.access(MODEL_PATH).then(() => true).catch(() => false);
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ exists }) }] };
  }
  throw new Error(`Resource desconhecido: ${uri}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
