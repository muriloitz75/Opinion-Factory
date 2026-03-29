#!/usr/bin/env node
/**
 * Hook: PreToolUse → Bash
 * Bloqueia git commit se lint, typecheck ou testes falharem.
 * Recebe JSON via stdin com { tool_name, tool_input: { command } }
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ROOT = process.cwd();

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
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // JSON inválido — não bloquear
  }

  const command = input?.tool_input?.command ?? '';

  // Só intercepta git commit
  if (!/git\s+commit/.test(command)) {
    process.exit(0);
  }

  const failures = [];

  // ── ESLint ───────────────────────────────────────────────
  try {
    execSync('npm run lint', { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    const out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    failures.push(`ESLint\n${out.slice(0, 800)}`);
  }

  // ── TypeScript ───────────────────────────────────────────
  try {
    execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    const out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    failures.push(`TypeScript\n${out.slice(0, 800)}`);
  }

  // ── Vitest ───────────────────────────────────────────────
  try {
    execSync('npm test', { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    const out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    failures.push(`Testes (Vitest)\n${out.slice(0, 800)}`);
  }

  if (failures.length > 0) {
    process.stderr.write(
      `Quality Gate bloqueou o commit. Corrija os erros antes de commitar:\n\n` +
      failures.map((f, i) => `${i + 1}. ${f}`).join('\n\n')
    );
    process.exit(2); // Bloqueia o commit
  }

  // Tudo passou — libera
  process.exit(0);
}

run().catch(() => process.exit(0));
