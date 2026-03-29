#!/usr/bin/env node
/**
 * Hook: PostToolUse → Write | Edit
 * Valida estrutura ABNT de templates Markdown salvos em Docs/.
 * Recebe JSON via stdin com { tool_name, tool_input: { file_path, content? } }
 * Não bloqueia — informa Claude sobre violações via stdout (contexto adicional).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Padrões de classificação de blocos ───────────────────────

const PATTERNS = {
  parecer:  /^PARECER\b/i,
  metadata: /^(PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ|N[Oº°][.º°]?\s|REF(?:ERÊNCIA)?[:\s]|AUTOS|ENDEREÇO|INSCRIÇÃO|VISTORIA)\b/i,
  date:     /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,25},\s*(\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+\s+de\s+\d{4}|\{\{[^}]+\}\})/i,
  heading:  /^\s{0,3}#{1,6} /,
  fecho:    /submeto à douta consideração superior/i,
};

const ISOLATED = ['parecer', 'metadata', 'date', 'heading', 'fecho'];

function classifyLine(line) {
  const p = line.trim();
  if (!p) return 'empty';
  if (PATTERNS.heading.test(line)) return 'heading';
  if (PATTERNS.parecer.test(p))    return 'parecer';
  if (PATTERNS.metadata.test(p))   return 'metadata';
  if (PATTERNS.date.test(p))       return 'date';
  if (PATTERNS.fecho.test(p))      return 'fecho';
  return 'body';
}

function validateStructure(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const type = classifyLine(lines[i]);
    if (!ISOLATED.includes(type)) continue;

    const prev = i > 0 ? lines[i - 1] : null;
    const next = i < lines.length - 1 ? lines[i + 1] : null;

    if (prev !== null && prev.trim() !== '' && i > 0)
      violations.push({ line: i + 1, type, problem: `falta linha em branco antes do bloco "${type}"` });
    if (next !== null && next.trim() !== '')
      violations.push({ line: i + 1, type, problem: `falta linha em branco depois do bloco "${type}"` });
  }
  return violations;
}

function validateVariableNames(content) {
  const issues = [];
  for (const m of content.matchAll(/\{\{([^}]+)\}\}/g)) {
    const name = m[1].trim();
    if (/\s/.test(name))
      issues.push({ variable: name, problem: `espaço no nome — use camelCase: {{${name.replace(/\s+(.)/g, (_, c) => c.toUpperCase())}}}` });
    else if (/_/.test(name))
      issues.push({ variable: name, problem: `snake_case — prefira camelCase: {{${name.replace(/_(.)/g, (_, c) => c.toUpperCase())}}}` });
  }
  return issues;
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

async function run() {
  const raw = await readStdin();

  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  const filePath = input?.tool_input?.file_path ?? '';

  // Só processa arquivos Markdown dentro de Docs/
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (!normalizedPath.includes('/Docs/') || !filePath.endsWith('.md')) {
    process.exit(0);
  }

  // Lê o conteúdo do arquivo (já foi escrito pelo Write/Edit)
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    process.exit(0);
  }

  const structureViolations = validateStructure(content);
  const variableIssues      = validateVariableNames(content);
  const allIssues           = [...structureViolations, ...variableIssues];

  if (allIssues.length === 0) {
    // Fornece contexto positivo para Claude
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        additionalContext: `Template ${path.basename(filePath)} validado com sucesso — estrutura ABNT e variáveis corretas.`,
      },
    }));
    process.exit(0);
  }

  // Passa a lista de violações ao Claude como contexto
  const details = allIssues
    .map((v, i) => `${i + 1}. ${v.line ? `Linha ${v.line}: ` : ''}${v.problem ?? v.issue}`)
    .join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      additionalContext:
        `Validação ABNT do template ${path.basename(filePath)} encontrou ${allIssues.length} problema(s):\n${details}\n\nConsidere corrigir antes de prosseguir.`,
    },
  }));

  process.exit(0); // Não bloqueia — apenas informa
}

run().catch(() => process.exit(0));
