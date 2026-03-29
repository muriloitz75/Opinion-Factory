/**
 * Normalização inteligente do HTML gerado pelo mammoth/markdown para
 * exibição no preview com formatação ABNT impecável.
 *
 * Problemas tratados pelo Scanner ABNT:
 *  1. Parágrafos vazios (espaçadores do Word) → removidos
 *  2. Parágrafos em negrito + caixa alta usados como títulos → <h1>/<h2>/<h3>
 *  3. Espaçamento duplicado entre seções → colapsado
 *  4. Purificação de ruídos (spans vazios, &nbsp;, espaços duplos)
 *  5. Scanner de contexto ABNT → remove recuo após títulos e em metadados
 */

// ── Helpers ──────────────────────────────────────────────────

/** Verifica se o texto é composto predominantemente de letras maiúsculas. */
function isUpperCase(text: string): boolean {
  // Strip variável placeholders ({{Foo}}) before checking case — lowercase in variable names
  // must not affect the uppercase test of the surrounding content.
  const withoutVars = text.replace(/\{\{[^}]+\}\}/g, '');
  const letters = withoutVars.replace(/[^a-zA-ZÀ-ÿ]/g, '');
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
  // Título do documento (ex: "PARECER DIAAF Nº 001/2025") → h1 centralizado
  if (/^PARECER\b/i.test(text)) return 'h1';
  return 'h2';
}

// ── Remoção de parágrafos vazios ─────────────────────────────

/**
 * Limpeza inicial de ruídos de HTML gerados por conversores.
 */
function purifyHtml(html: string): string {
  let result = html;
  // Espaços não-quebráveis → espaço comum
  result = result.replace(/&nbsp;|&#160;/g, ' ');
  // Caracteres invisíveis do Word: soft hyphen, zero-width, BOM, word-joiner
  result = result.replace(/\u00AD/g, '');
  result = result.replace(/[\u200B\u200C\u200D\uFEFF\u2060]/g, '');
  // Entidades HTML de controle: carriage return
  result = result.replace(/&#13;|&#xD;|&#x0D;/gi, '');
  // Spans com style inline gerados pelo Word/mammoth — mantém apenas o conteúdo
  result = result.replace(/<span[^>]+style="[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  // Spans sem atributos
  result = result.replace(/<span>([^<]*)<\/span>/gi, '$1');
  // Normaliza espaços múltiplos
  result = result.replace(/[ \t]+/g, ' ');
  return result;
}

/**
 * Remove <p> cujo conteúdo textual seja vazio (incluindo <br>, espaços).
 */
function removeEmptyParagraphs(html: string): string {
  return html.replace(
    /<p([^>]*)>((?:\s|<br\s*\/?>)*)<\/p>/gi,
    (match, _attrs, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();
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
  // Chamada via purifyHtml agora, mas mantido para compatibilidade se necessário
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

// ── Remoção de recuo após títulos ───────────────────────────

/**
 * ABNT NBR 14724: O primeiro parágrafo após um título não deve ter recuo.
 * 
 * Estratégia de Scanner Procedural:
 * Em vez de uma regex cega, percorremos os blocos. Quando encontramos um h1-h3,
 * o próximo parágrafo <p> obrigatoriamente recebe a classe .abnt-no-indent.
 */
function removeHeadingIndent(html: string): string {
  // 1. Scanner de Títulos: Divide o HTML preservando os títulos (h1, h2, h3)
  const parts = html.split(/(<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>)/gi);
  let result = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    result += part;
    
    // Se a parte atual for um título de seção (h1, h2, h3)
    if (/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/i.test(part)) {
      // PROCURA GULOSA: Scanear as próximas partes até encontrar o primeiro parágrafo real
      for (let j = i + 1; j < parts.length; j++) {
        const nextPart = parts[j];
        
        // Se encontrarmos outro título antes de um parágrafo, paramos (seção sem corpo)
        if (/<h[1-6][^>]*>/i.test(nextPart)) break;
        
        // Se encontrarmos um parágrafo <p>...
        if (/<p([^>]*)>/i.test(nextPart)) {
          parts[j] = nextPart.replace(/<p([^>]*)>/i, (match, attrs) => {
            // REMOÇÃO REDUNDANTE: Remove qualquer estilo inline de text-indent que possa estar no parágrafo
            const cleanAttrs = attrs.replace(/style="[^"]*text-indent:[^"]*"/gi, (styleMatch: string) => {
               // Limpa apenas o indent de dentro do style
               return styleMatch.replace(/text-indent\s*:\s*([^;]+);?/gi, '');
            });

            // Adiciona a classe abnt-no-indent
            if (/class="/i.test(cleanAttrs)) {
              return cleanAttrs.includes('abnt-no-indent') 
                ? `<p${cleanAttrs}>` 
                : `<p${cleanAttrs.replace(/class="([^"]*)"/i, 'class="$1 abnt-no-indent')}>`;
            }
            return `<p class="abnt-no-indent"${cleanAttrs}>`;
          });
          break; // Scanner atendeu a regra ABNT para esta transição
        }
      }
    }
  }
  
  return result;
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
    /<p([^>]*)>([\s\S]*?)<\/p>/gi,
    (match, attrs, inner) => {
      // Strip PUA markers (\uE010…\uE011) usados pelo pipeline de preview .docx antes da comparação.
      const text = inner.replace(/<[^>]+>/g, '').replace(/[\uE010\uE011]/g, '').trim();

      // 1. Parecer (Centralizado) - Apenas se for a palavra isolada ou início curto
      if (text.toUpperCase() === 'PARECER' || (text.toUpperCase().startsWith('PARECER') && text.length < 30)) {
        return `<p class="abnt-centered font-bold abnt-parecer">${inner}</p>`;
      }

      // 2. Metadados (Sem recuo, Alinhado à esquerda) - Processo, Interessado, Assunto, CPF, etc.
      const metaKeywords = 'PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ|N[º°]|REF|AUTOS|REFERÊNCIA|VISTORIA|ENDEREÇO|INSCRIÇÃO';
      const metaRegex = new RegExp(`^\\s*(${metaKeywords})`, 'i');
      if (metaRegex.test(text)) {
        return `<p class="abnt-no-indent abnt-left">${inner}</p>`;
      }

      // 3. Data (Alinhado à direita) — detecta DD de mês de AAAA, DD/MM/AAAA ou placeholder {{var}}
      const dateRegex = /^[a-zA-ZÀ-ÿ\s]{2,40},\s*(?:\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4}|\d{1,2}\/\d{2}\/\d{4}|\{\{.+\}\})/i;
      if (dateRegex.test(text)) {
        return `<p class="abnt-right abnt-data-block">${inner}</p>`;
      }

      // 4. Fecho por conteúdo conhecido (fallback — posição é detectada em applyFechoByPosition)
      if (text.includes('Submeto à douta consideração superior')) {
        return `<p class="abnt-no-indent abnt-closing">${inner}</p>`;
      }

      return match;
    }
  );
}

/**
 * Detecta o fecho por posição: o último parágrafo de corpo (sem classes ABNT especiais)
 * imediatamente antes do primeiro bloco de data recebe as classes de fecho.
 * Só aplica se nenhum fecho já foi detectado por conteúdo.
 */
function applyFechoByPosition(html: string): string {
  if (html.includes('abnt-closing')) return html;

  const dataIdx = html.indexOf('abnt-data-block');
  if (dataIdx === -1) return html;

  const beforeDate = html.substring(0, dataIdx);

  // Encontra o último <p> sem classes ABNT especiais antes do bloco de data
  const pRegex = /<p(?![^>]*(?:abnt-centered|abnt-no-indent|abnt-right|abnt-parecer|font-bold))[^>]*>[\s\S]*?<\/p>/gi;
  let lastMatch: { index: number; full: string } | null = null;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(beforeDate)) !== null) {
    lastMatch = { index: m.index, full: m[0] };
  }

  if (!lastMatch) return html;

  const newP = lastMatch.full.replace(/<p([^>]*)>/i, (_, attrs) => {
    if (/class="/i.test(attrs)) {
      return `<p${attrs.replace(/class="([^"]*)"/i, 'class="$1 abnt-no-indent abnt-closing"')}>`;
    }
    return `<p class="abnt-no-indent abnt-closing"${attrs}>`;
  });

  return (
    html.substring(0, lastMatch.index) +
    newP +
    html.substring(lastMatch.index + lastMatch.full.length)
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
  
  // FASE 1: Scanner de Purificação
  result = purifyHtml(result);
  result = removeEmptyParagraphs(result);
  
  // FASE 2: Scanner de Estrutura
  result = promoteManualHeadings(result);
  result = deduplicateHeadings(result);
  result = normalizeManualBullets(result);
  result = mergeConsecutiveLists(result);
  
  // FASE 3: Scanner ABNT de Contexto
  result = standardizeLegalBlocks(result);
  result = applyFechoByPosition(result);
  // Nota: pareceres fiscais recuam TODOS os parágrafos de corpo (incluindo o primeiro
  // após título). A regra "sem recuo no 1º parágrafo de seção" é da ABNT acadêmica
  // e não se aplica aqui. removeHeadingIndent() foi removida do pipeline.
  
  // FASE 4: Polimento de Layout
  result = collapseBlankGaps(result);

  return result;
}
