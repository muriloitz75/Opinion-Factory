/**
 * Normalização inteligente do HTML gerado pelo mammoth/markdown para
 * exibição no preview com formatação ABNT impecável.
 *
 * Problemas tratados:
 *  1. Parágrafos vazios (espaçadores do Word) → removidos
 *  2. Parágrafos em negrito + caixa alta usados como títulos (sem style Heading) → <h1>/<h2>/<h3>
 *  3. Espaçamento duplicado entre seções → colapsado
 *  4. Runs redundantes sem formatação → simplificados
 */

// ── Helpers ──────────────────────────────────────────────────

/** Verifica se o texto é composto predominantemente de letras maiúsculas. */
function isUpperCase(text: string): boolean {
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (letters.length === 0) return false;
  return letters === letters.toUpperCase();
}

/**
 * Classifica o nível do título com base no padrão textual.
 *  - "1.2.3 Subtítulo"   → h3
 *  - "1.2 Subtítulo"     → h3
 *  - "1. TÍTULO"         → h2
 *  - "CONCLUSÃO"         → h2
 *  - "PARECER FISCAL"    → h1  (sem número, sem subordinação)
 */
function headingLevel(text: string): 'h1' | 'h2' | 'h3' {
  if (/^\d+\.\d+/.test(text)) return 'h3';
  if (/^\d+[.)]\s/.test(text)) return 'h2';
  return 'h2';
}

// ── Remoção de parágrafos vazios ─────────────────────────────

/**
 * Remove <p> cujo conteúdo textual seja vazio (incluindo &nbsp;, <br>, espaços).
 */
function removeEmptyParagraphs(html: string): string {
  return html.replace(
    /<p([^>]*)>((?:\s|&nbsp;|&#160;|<br\s*\/?>)*)<\/p>/gi,
    (match, _attrs, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, '').trim();
      return text ? match : '';
    }
  );
}

// ── Detecção e promoção de cabeçalhos ────────────────────────

/**
 * Converte <p><strong>TEXTO EM CAIXA ALTA</strong></p> em headings semânticos.
 * Também lida com variantes: <p><em><strong>…</strong></em></p> e alinhamento inline.
 */
/** Verifica se o parágrafo está explicitamente centralizado via style inline. */
function isCenteredAttrs(attrs: string): boolean {
  return /text-align\s*:\s*center/i.test(attrs);
}

function promoteManualHeadings(html: string): string {
  // Padrão 1: <p [attrs]><strong>TEXT</strong></p>  (com possíveis espaços ao redor)
  html = html.replace(
    /<p([^>]*)>\s*<strong>([^<]{1,160})<\/strong>\s*<\/p>/gi,
    (match, attrs, inner) => {
      const text = inner.trim();
      if (!isUpperCase(text)) return match;
      // Parágrafos centralizados com negrito e caixa alta → h1 (CSS centraliza)
      const level = isCenteredAttrs(attrs) ? 'h1' : headingLevel(text);
      return `<${level}>${text}</${level}>`;
    }
  );

  // Padrão 2: <p [attrs]><em><strong>TEXT</strong></em></p>
  html = html.replace(
    /<p([^>]*)>\s*<em>\s*<strong>([^<]{1,160})<\/strong>\s*<\/em>\s*<\/p>/gi,
    (match, attrs, inner) => {
      const text = inner.trim();
      if (!isUpperCase(text)) return match;
      const level = isCenteredAttrs(attrs) ? 'h1' : headingLevel(text);
      return `<${level}>${text}</${level}>`;
    }
  );

  // Padrão 3: <p> com conteúdo misto mas 100% em <strong> — ex: bold com número
  // "<p><strong>1.</strong> <strong>DO FATO</strong></p>"
  html = html.replace(
    /<p([^>]*)>((?:\s*<strong>[^<]{1,80}<\/strong>\s*)+)<\/p>/gi,
    (match, attrs, inner) => {
      const text = inner.replace(/<\/?strong>/gi, '').trim();
      if (!isUpperCase(text) || text.length > 160) return match;
      const level = isCenteredAttrs(attrs) ? 'h1' : headingLevel(text);
      return `<${level}>${text}</${level}>`;
    }
  );

  return html;
}

// ── Colapso de heading duplicado ─────────────────────────────

/**
 * Quando o documento tem tanto h1 gerado pelo styleMap quanto o parágrafo bold
 * convertido, pode duplicar. Aqui colapsa headings consecutivos idênticos.
 */
function deduplicateHeadings(html: string): string {
  return html.replace(
    /(<h([1-6])>([^<]+)<\/h\2>)\s*\1/gi,
    '$1'
  );
}

// ── Limpeza de spans vazios ou redundantes ───────────────────

function cleanRedundantSpans(html: string): string {
  // Remove <span> sem atributos
  return html.replace(/<span>([^<]*)<\/span>/gi, '$1');
}

// ── Normaliza listas geradas pelo mammoth ────────────────────

/**
 * Parágrafos com class="abnt-list-item" gerados pelo styleMap mas que
 * na prática contêm bullet manual (• ▪ – →) → converte para <li> em <ul>.
 */
function normalizeManualBullets(html: string): string {
  return html.replace(
    /<p[^>]*class="[^"]*abnt-list-item[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
    (match, inner) => {
      const text = inner.trim();
      // Remove bullet manual do início se presente
      const cleaned = text.replace(/^[•▪▸►–—\-]\s*/, '');
      return `<ul><li>${cleaned}</li></ul>`;
    }
  );
}

/**
 * Agrupa <ul><li>…</li></ul> consecutivos em uma única <ul>.
 */
function mergeConsecutiveLists(html: string): string {
  return html.replace(/<\/ul>\s*<ul>/gi, '');
}

// ── Padronização de Blocos Legais (Imagens) ───────────────────

/**
 * Identifica e formata blocos específicos baseados no conteúdo textual.
 *  - "PARECER" → centralizado (.abnt-centered)
 *  - "PROCESSO", "INTERESSADO", "ASSUNTO" → sem recuo (.abnt-no-indent)
 *  - "Cidade, {{Data}}" → alinhado à direita (.abnt-right)
 */
function standardizeLegalBlocks(html: string): string {
  return html.replace(
    /<p([^>]*)>(.*?)<\/p>/gi,
    (match, attrs, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();

      // 1. Parecer (Centralizado)
      if (text.toUpperCase().startsWith('PARECER')) {
        return `<p class="abnt-centered font-bold abnt-parecer">${inner}</p>`;
      }

      // 2. Metadados (Sem recuo, Alinhamento Esquerda)
      if (/(PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ)/i.test(text)) {
        return `<p class="abnt-no-indent abnt-left">${inner}</p>`;
      }

      // 3. Data (Alinhado à direita)
      if (/^[a-zA-ZÀ-ÿ\s]+,\s*\{\{.+\}\}/i.test(text) || /^Imperatriz/i.test(text)) {
        return `<p class="abnt-right abnt-data-block">${inner}</p>`;
      }

      // 4. Fecho (Sem recuo e 6pt superior)
      if (text.includes('É o parecer. Submeto à douta consideração superior.')) {
        return `<p class="abnt-no-indent abnt-closing">${inner}</p>`;
      }

      return match;
    }
  );
}

// ── Normaliza espaçamento entre seções ───────────────────────

/**
 * Previne acúmulo de múltiplos parágrafos vazios consecutivos.
 * Após a remoção individual já feita, garante que não sobrem sequências.
 */
function collapseBlankGaps(html: string): string {
  // Remove dois ou mais newlines/whitespace entre tags
  return html.replace(/(<\/(?:p|h[1-6]|ul|ol|blockquote|table)>)\s{2,}(<(?:p|h[1-6]|ul|ol|blockquote|table)[^>]*>)/gi, '$1\n$2');
}

// ── Ponto de entrada ─────────────────────────────────────────

/**
 * Aplica todas as normalizações em sequência ao HTML gerado pelo mammoth.
 * A ordem importa:
 *  1. Remove vazios (evita promoção errônea)
 *  2. Promove headings manuais
 *  3. Deduplica headings
 *  4. Agrupa listas
 *  5. Limpa spans e espaços
 */
export function normalizeDocumentHtml(html: string): string {
  if (!html.trim()) return html;

  let result = html;
  result = removeEmptyParagraphs(result);
  result = promoteManualHeadings(result);
  result = deduplicateHeadings(result);
  result = normalizeManualBullets(result);
  result = mergeConsecutiveLists(result);
  result = standardizeLegalBlocks(result);
  result = cleanRedundantSpans(result);
  result = collapseBlankGaps(result);

  return result;
}
