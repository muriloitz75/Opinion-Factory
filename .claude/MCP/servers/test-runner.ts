/**
 * MCP Server: test-runner
 * Envolve Vitest, ESLint e TypeScript como ferramentas chamáveis por agentes.
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
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const ROOT = path.resolve(import.meta.dirname, '../../../');

// ── Cache ────────────────────────────────────────────────────

let lastTest: object | null = null;
let lastLint: object | null = null;

// ── Parsers ──────────────────────────────────────────────────

function parseVitest(stdout: string, stderr: string) {
  const combined = stdout + stderr;
  const passed  = parseInt(combined.match(/Tests\s+(\d+) passed/)?.[1]  ?? '0');
  const failed  = parseInt(combined.match(/(\d+) failed/)?.[1]          ?? '0');
  const durRaw  = combined.match(/Duration\s+([\d.]+)(ms|s)/);
  const durationMs = durRaw ? (durRaw[2] === 's' ? parseFloat(durRaw[1]) * 1000 : parseFloat(durRaw[1])) : 0;
  const files = combined.split('\n')
    .filter(l => l.match(/src.+\.test\.ts/))
    .map(l => ({
      file:   l.match(/(src[^\s]+\.test\.ts)/)?.[1] ?? '',
      passed: parseInt(l.match(/(\d+) passed/)?.[1] ?? '0'),
      failed: parseInt(l.match(/(\d+) failed/)?.[1] ?? '0'),
    }))
    .filter(f => f.file);
  return { passed, failed, skipped: 0, durationMs: Math.round(durationMs), files };
}

function parseEslint(stdout: string) {
  const issues: object[] = [];
  for (const line of stdout.split('\n')) {
    const m = line.match(/(.+):(\d+):(\d+):\s+(error|warning)\s+(.+)\s+([\w/@-]+)$/);
    if (m) issues.push({ file: m[1].replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, ''), line: +m[2], column: +m[3], severity: m[4], message: m[5].trim(), rule: m[6] });
  }
  return { errors: issues.filter((i: any) => i.severity === 'error').length, warnings: issues.filter((i: any) => i.severity === 'warning').length, issues };
}

async function findTestFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) result.push(...await findTestFiles(full));
    else if (e.name.endsWith('.test.ts')) result.push(full.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, ''));
  }
  return result;
}

// ── Servidor ─────────────────────────────────────────────────

const server = new Server(
  { name: 'test-runner', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'run_all_tests',    description: 'Executa npm test (vitest run) e retorna resultado estruturado.',             inputSchema: { type: 'object', properties: {} } },
    { name: 'run_test_file',    description: 'Executa um arquivo de teste específico.',                                    inputSchema: { type: 'object', required: ['filepath'], properties: { filepath: { type: 'string' } } } },
    { name: 'run_test_pattern', description: 'Executa testes cujo nome contém o padrão fornecido.',                       inputSchema: { type: 'object', required: ['pattern'],  properties: { pattern:  { type: 'string' } } } },
    { name: 'get_last_results', description: 'Retorna resultado da última execução de testes sem rodar novamente.',       inputSchema: { type: 'object', properties: {} } },
    { name: 'list_test_files',  description: 'Lista todos os arquivos de teste do projeto.',                              inputSchema: { type: 'object', properties: {} } },
    { name: 'run_lint',         description: 'Executa npm run lint (ESLint) e retorna erros/warnings estruturados.',      inputSchema: { type: 'object', properties: {} } },
    { name: 'run_typecheck',    description: 'Executa npx tsc --noEmit e retorna erros de tipo.',                         inputSchema: { type: 'object', properties: {} } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;
  const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 2) }] });

  switch (name) {
    case 'run_all_tests': {
      const { stdout = '', stderr = '' } = await execAsync('npm test', { cwd: ROOT }).catch(e => e);
      lastTest = { ...parseVitest(stdout, stderr), cachedAt: new Date().toISOString() };
      return text(lastTest);
    }

    case 'run_test_file': {
      const { filepath } = a as { filepath: string };
      const { stdout = '', stderr = '' } = await execAsync(`npx vitest run "${filepath}"`, { cwd: ROOT }).catch(e => e);
      return text(parseVitest(stdout, stderr));
    }

    case 'run_test_pattern': {
      const { pattern } = a as { pattern: string };
      const { stdout = '', stderr = '' } = await execAsync(`npx vitest run -t "${pattern}"`, { cwd: ROOT }).catch(e => e);
      return text({ pattern, ...parseVitest(stdout, stderr) });
    }

    case 'get_last_results':
      return text(lastTest ?? { message: 'Sem resultado em cache — execute run_all_tests primeiro' });

    case 'list_test_files': {
      const files = await findTestFiles(path.join(ROOT, 'src'));
      return text({ files, total: files.length });
    }

    case 'run_lint': {
      const { stdout = '', stderr = '' } = await execAsync('npm run lint', { cwd: ROOT }).catch(e => e);
      lastLint = parseEslint(stdout + stderr);
      return text(lastLint);
    }

    case 'run_typecheck': {
      const { stdout = '', stderr = '' } = await execAsync('npx tsc --noEmit', { cwd: ROOT }).catch(e => e);
      const combined = stdout + stderr;
      const errors = combined.split('\n').filter(l => l.includes(': error TS')).map(l => l.trim());
      return text({ errors: errors.length, diagnostics: errors });
    }

    default: throw new Error(`Tool desconhecida: ${name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: 'tests://results/last', name: 'Último resultado de testes', mimeType: 'application/json' },
    { uri: 'tests://files',        name: 'Arquivos de teste',          mimeType: 'application/json' },
    { uri: 'tests://lint/last',    name: 'Último resultado de lint',   mimeType: 'application/json' },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const { uri } = req.params;
  if (uri === 'tests://results/last') return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(lastTest  ?? { message: 'Sem cache' }) }] };
  if (uri === 'tests://lint/last')    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(lastLint  ?? { message: 'Sem cache' }) }] };
  if (uri === 'tests://files') {
    const files = await findTestFiles(path.join(ROOT, 'src'));
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ files }) }] };
  }
  throw new Error(`Resource desconhecido: ${uri}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
