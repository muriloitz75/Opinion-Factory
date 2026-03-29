#!/usr/bin/env node
/**
 * Hook: Stop
 * Verifica se arquivos em src/lib/ ou src/app/ foram modificados.
 * Se sim, instrui Claude a sugerir /review-rules ao usuário.
 * Recebe JSON via stdin com { stop_hook_active, last_assistant_message }
 */

'use strict';

const { execSync } = require('child_process');

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

  // Evita loop infinito — stop_hook_active é true quando já foi acionado nesta resposta
  if (input?.stop_hook_active === true) {
    process.exit(0);
  }

  // Verifica arquivos modificados no git
  let gitStatus = '';
  try {
    gitStatus = execSync('git status --porcelain', {
      cwd: process.cwd(),
      stdio: 'pipe',
    }).toString();
  } catch {
    process.exit(0); // Sem git ou erro — silencioso
  }

  // Detecta modificações em src/lib/ ou src/app/
  const srcModified = gitStatus
    .split('\n')
    .filter(line => line.trim())
    .some(line => /src\/(lib|app)\//.test(line));

  if (!srcModified) {
    process.exit(0); // Nada de relevante — silencioso
  }

  // Extrai os arquivos modificados para a mensagem
  const modifiedFiles = gitStatus
    .split('\n')
    .filter(line => /src\/(lib|app)\//.test(line))
    .map(line => line.replace(/^\s*\S+\s+/, '').trim())
    .slice(0, 5); // Máximo 5 arquivos na mensagem

  const fileList = modifiedFiles.map(f => `- ${f}`).join('\n');

  // Instrui Claude a lembrar o usuário sobre /review-rules
  process.stderr.write(
    `Arquivos de código fonte foram modificados nesta sessão:\n${fileList}\n\n` +
    `Lembre o usuário de rodar /review-rules para verificar se as regras em .claude/rules/ ` +
    `precisam ser atualizadas para refletir as mudanças.`
  );

  process.exit(2); // Bloqueia o Stop para que Claude entregue a mensagem
}

run().catch(() => process.exit(0));
