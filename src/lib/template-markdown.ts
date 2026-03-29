import {
  markdownToTemplateJson,
  extractVariablesFromTemplateJson,
  replaceVariablesInTemplateJson,
  blockTextToHtml,
  TemplateJsonBlock,
} from './template-json';
import { normalizeDocumentHtml } from './html-normalize';
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  convertMillimetersToTwip,
  LevelFormat,
} from 'docx';

/** Remove markdown inline syntax (bold, italic, code) keeping only plain text. */
function stripInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

const FONT = 'Times New Roman';
const SIZE = 24;          // 12pt em half-points
const LINE = 360;         // espaçamento 1,5 em twips (240 = simples)
const MARGIN_3CM = convertMillimetersToTwip(30);
const MARGIN_2CM = convertMillimetersToTwip(20);
const INDENT_125 = convertMillimetersToTwip(12.5);

/**
 * Converte markdown inline (**bold**, *italic*, ***bold italic***) em TextRun[].
 * Preserva formatação no DOCX em vez de descartar com stripInline.
 */
function parseInlineToRuns(
  raw: string,
  opts: { bold?: boolean }
): TextRun[] {
  const runs: TextRun[] = [];
  // Matches: ***bold italic***, **bold**, *italic*, _italic_, or plain text
  const re = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|([^*_]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[2] !== undefined) {
      runs.push(new TextRun({ text: m[2], bold: true, italics: true, font: FONT, size: SIZE }));
    } else if (m[3] !== undefined) {
      runs.push(new TextRun({ text: m[3], bold: true, font: FONT, size: SIZE }));
    } else if (m[4] !== undefined || m[5] !== undefined) {
      runs.push(new TextRun({ text: m[4] ?? m[5], italics: true, font: FONT, size: SIZE }));
    } else if (m[6] !== undefined) {
      runs.push(new TextRun({ text: m[6], bold: opts.bold, font: FONT, size: SIZE }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text: raw, bold: opts.bold, font: FONT, size: SIZE })];
}

function blockToParagraphs(block: TemplateJsonBlock, idx: number, blocks: TemplateJsonBlock[]): Paragraph[] {
  if (block.type === 'heading') {
    const isTopLevel = block.level <= 3;
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: stripInline(block.text),
            bold: true,
            allCaps: isTopLevel,
            font: FONT,
            size: SIZE,
          }),
        ],
        heading: (
          [
            HeadingLevel.HEADING_1,
            HeadingLevel.HEADING_2,
            HeadingLevel.HEADING_3,
            HeadingLevel.HEADING_4,
            HeadingLevel.HEADING_5,
            HeadingLevel.HEADING_6,
          ] as const
        )[block.level - 1],
        alignment: block.level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: {
          before: convertMillimetersToTwip(8.47),
          after: convertMillimetersToTwip(4.23),
          line: LINE,
        },
      }),
    ];
  }

  if (block.type === 'paragraph') {
    // Split on hard-break newlines introduced by "  " trailing in markdown.
    // Each sub-line gets its own Paragraph with independent formatting detection.
    const lines = block.text.split('\n').map(l => l.trim()).filter(Boolean);

    return lines.map((lineText, lineIdx) => {
      const plain = stripInline(lineText);
      let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED;
      let indent = { firstLine: INDENT_125 };
      let spacing: { line: number; before?: number; after?: number } = { line: LINE };
      let blockBold = false;

      // 1. Parecer (Centralizado, Negrito)
      if (plain.toUpperCase().startsWith('PARECER')) {
        alignment = AlignmentType.CENTER;
        indent = { firstLine: 0 };
        spacing = { line: LINE, after: 240 };
        blockBold = true;
      }
      // 2. Metadados (Esquerda, Sem recuo)
      else if (/^\s*(PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ|N[º°]|REF|AUTOS|REFERÊNCIA)/i.test(plain)) {
        alignment = AlignmentType.LEFT;
        indent = { firstLine: 0 };
        spacing = { line: LINE, after: 0, before: 0 };
      }
      // 3. Data (Direita) — detecta DD de mês de AAAA, DD/MM/AAAA ou placeholder {{var}}
      else if (
        /^[a-zA-ZÀ-ÿ\s]+,\s*(?:\d{1,2}\s+de\s+[a-zA-ZÀ-ÿ]+\s+de\s+\d{4}|\d{1,2}\/\d{2}\/\d{4}|\{\{.+\}\})/i.test(plain)
      ) {
        alignment = AlignmentType.RIGHT;
        indent = { firstLine: 0 };
        spacing = { line: LINE, before: 240 };
      }
      // 4. Fecho
      else if (/submeto à douta consideração superior/i.test(plain)) {
        indent = { firstLine: 0 };
        spacing = { line: LINE, before: 120 };
      }
      // Nota: pareceres fiscais recuam todos os parágrafos de corpo,
      // inclusive o primeiro após título. Regra removida intencionalmente.

      return new Paragraph({
        children: parseInlineToRuns(lineText, { bold: blockBold }),
        alignment,
        indent,
        spacing,
      });
    });
  }

  if (block.type === 'list') {
    return block.items.map((item) =>
      new Paragraph({
        numbering: block.ordered
          ? { reference: 'ordered-list', level: 0 }
          : undefined,
        bullet: block.ordered ? undefined : { level: 0 },
        children: parseInlineToRuns(item, {}),
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: LINE },
      })
    );
  }

  return [];
}

// ── Public API ──────────────────────────────────────────────

/**
 * Converte markdown com variáveis já substituídas em HTML semântico
 * compatível com a camada de estilos ABNT do paper-content.
 */
export function markdownToHtml(content: string, values: Record<string, string>): string {
  // Gera o HTML com {{key}} ainda no lugar — variáveis NÃO são substituídas antes
  // da normalização para que a detecção de blocos (PARECER, metadata, data) funcione
  // corretamente com placeholders, e para que possamos colorir os valores depois.
  const parsed = markdownToTemplateJson(content);

  const raw = parsed.blocks
    .map(block => {
      if (block.type === 'heading') {
        const l = block.level;
        return `<h${l}>${blockTextToHtml(block.text)}</h${l}>`;
      }
      if (block.type === 'paragraph') {
        const lines = block.text.split('\n').filter(l => l.trim());
        return lines.map(l => `<p>${blockTextToHtml(l)}</p>`).join('\n');
      }
      if (block.type === 'list') {
        const tag = block.ordered ? 'ol' : 'ul';
        const items = block.items.map(i => `<li>${blockTextToHtml(i)}</li>`).join('');
        return `<${tag}>${items}</${tag}>`;
      }
      return '';
    })
    .join('\n');

  let html = normalizeDocumentHtml(raw);

  // Substitui {{key}} por span colorido quando preenchido, ou mantém o placeholder.
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`\\{\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g');
    if (value) {
      const safe = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html = html.replace(re, `<span class="var-filled">${safe}</span>`);
    }
  }

  return html;
}

export function extractVariablesFromMarkdown(content: string): string[] {
  const doc = markdownToTemplateJson(content);
  return extractVariablesFromTemplateJson(doc);
}

export async function markdownToDocxBuffer(
  content: string,
  values: Record<string, string>
): Promise<Buffer> {
  const parsed = markdownToTemplateJson(content);
  const filled = replaceVariablesInTemplateJson(parsed, values);

  const children = filled.blocks.flatMap((block, idx) => blockToParagraphs(block, idx, filled.blocks));

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'ordered-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: INDENT_125, hanging: convertMillimetersToTwip(6) },
                },
                run: { font: FONT, size: SIZE },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN_3CM,
              right: MARGIN_2CM,
              bottom: MARGIN_2CM,
              left: MARGIN_3CM,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
