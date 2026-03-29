/**
 * Normalizador estrito de markdown para pareceres fiscais.
 *
 * Regras impostas (sem tolerância a inconsistências):
 *  1. Linhas de tipo especial (PARECER, metadados, data, fecho, títulos) devem
 *     estar isoladas: linha em branco obrigatória antes e depois.
 *  2. Múltiplas linhas em branco consecutivas → colapso para uma única.
 *  3. Espaços à direita: normalizado para exatamente dois (hard break `  `) se a
 *     linha era um hard-break intencional; caso contrário, removidos.
 *  4. O documento não começa nem termina com linhas em branco.
 */

// ── Tipos internos ────────────────────────────────────────────

type LineType =
  | 'empty'
  | 'heading'
  | 'list-item'
  | 'list-continuation'
  | 'parecer'
  | 'metadata'
  | 'date'
  | 'fecho'
  | 'body';

// Linhas desses tipos devem ser isoladas (blank antes e depois).
const ISOLATED: ReadonlySet<LineType> = new Set([
  'heading',
  'parecer',
  'metadata',
  'date',
  'fecho',
]);

// ── Helpers ───────────────────────────────────────────────────

/** Remove marcação inline de markdown para análise semântica do conteúdo. */
function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

/**
 * Classifica semanticamente uma linha do markdown.
 * Recebe o tipo da última linha não-vazia para detectar continuações de lista.
 */
function classifyLine(line: string, prevNonEmptyType: LineType): LineType {
  if (!line.trim()) return 'empty';

  // Continuação de item de lista (indentação ≥ 2 espaços após list-item)
  if (
    /^ {2,}/.test(line) &&
    (prevNonEmptyType === 'list-item' || prevNonEmptyType === 'list-continuation')
  ) {
    return 'list-continuation';
  }

  // Título com # (padrão markdown)
  if (/^\s{0,3}#{1,6} /.test(line)) return 'heading';

  // Seção numerada em negrito: "1. **TÍTULO**" — tratada como h2 pelo parser
  if (/^\s*\d+\.\s+\*\*[^*\n]+\*\*\s*$/.test(line)) return 'heading';

  // Item de lista (deve vir depois da seção numerada em negrito)
  if (/^\s*[-*+] /.test(line) || /^\s*\d+[.)]\s+\S/.test(line)) return 'list-item';

  // Análise semântica: remove formatação inline antes de testar conteúdo
  const plain = stripMarkdownInline(line.trim());

  // Linha PARECER (bloco parágrafo, sem #)
  if (/^PARECER\b/i.test(plain)) return 'parecer';

  // Metadados legais (palavras-chave no início da linha)
  if (
    /^(PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ|N[Oº°][.º°]?\s|REF(?:ERÊNCIA)?[:\s]|AUTOS|ENDEREÇO|INSCRIÇÃO|VISTORIA)\b/i.test(
      plain
    )
  ) {
    return 'metadata';
  }

  // Data: "Cidade, dd de mês de aaaa"  ou  "Cidade, {{variável}}"
  if (
    /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,25},\s*(\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+\s+de\s+\d{4}|\{\{[^}]+\}\})/i.test(
      plain
    )
  ) {
    return 'date';
  }

  // Fecho jurídico
  if (/submeto à douta consideração superior/i.test(plain)) return 'fecho';

  return 'body';
}

/** Normaliza espaços à direita: preserva exatamente 2 para hard-break; remove os demais. */
function normalizeTrailingSpaces(line: string): string {
  if (/ {2,}$/.test(line)) {
    return line.replace(/\s+$/, '  ');
  }
  return line.trimEnd();
}

// ── Ponto de entrada ──────────────────────────────────────────

/**
 * Normaliza um arquivo markdown de parecer fiscal seguindo as regras estritas
 * de isolamento de blocos semânticos.
 *
 * @returns Conteúdo normalizado (com `\n` final).
 */
export function normalizeMarkdown(content: string): string {
  // Padroniza quebras de linha
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Passo 1 — classifica cada linha (necessita do tipo da linha anterior)
  const classified: Array<{ line: string; type: LineType }> = [];
  let prevNonEmptyType: LineType = 'body';
  for (const line of lines) {
    const type = classifyLine(line, prevNonEmptyType);
    classified.push({ line, type });
    if (type !== 'empty') prevNonEmptyType = type;
  }

  // Passo 2 — reconstrói o documento aplicando as regras de isolamento
  const out: string[] = [];

  for (let i = 0; i < classified.length; i++) {
    const { line, type } = classified[i];

    if (type === 'empty') {
      // Suprime linhas em branco duplicadas (a segunda em branco consecutiva)
      if (out.length > 0 && out[out.length - 1] !== '') {
        out.push('');
      }
      continue;
    }

    // Linha especial → garantir linha em branco ANTES (se não for início do documento)
    if (ISOLATED.has(type) && out.length > 0 && out[out.length - 1] !== '') {
      out.push('');
    }

    // Adiciona a linha normalizada
    out.push(normalizeTrailingSpaces(line));

    // Linha especial → garantir linha em branco DEPOIS (se próxima não for vazia)
    if (ISOLATED.has(type)) {
      const next = classified[i + 1];
      if (next && next.type !== 'empty') {
        out.push('');
      }
    }
  }

  // Passo 3 — remove linhas em branco no início/fim e retorna com \n final
  const result = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return result ? result + '\n' : '';
}

/**
 * Retorna `true` se o conteúdo já está em conformidade com as regras.
 * Útil para decidir se deve exibir aviso ao usuário.
 */
export function isMarkdownNormalized(content: string): boolean {
  return normalizeMarkdown(content) === content;
}
