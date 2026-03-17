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

function blockToParagraphs(block: TemplateJsonBlock, idx: number): Paragraph[] {
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
          before: convertMillimetersToTwip(6.35),
          after: convertMillimetersToTwip(4.23),
          line: LINE,
        },
      }),
    ];
  }

  if (block.type === 'paragraph') {
    const text = stripInline(block.text);
    let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED;
    let indent = { firstLine: INDENT_125 };
    let spacing: { line: number; before?: number; after?: number } = { line: LINE };
    let bold = false;

    // Padronização de Blocos Legais (Paridade com Preview)
    
    // 1. Parecer (Centralizado, Negrito, 12pt inf)
    if (text.toUpperCase().startsWith('PARECER')) {
      alignment = AlignmentType.CENTER;
      indent = { firstLine: 0 };
      spacing = { line: LINE, after: 240 }; // 12pt = 240 twips
      bold = true;
    }
    // 2. Metadados (Sem recuo, Esquerda, Espaçamento compacto)
    else if (/^\s*(PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ|N[º°]|REF|AUTOS|REFERÊNCIA)/i.test(text)) {
      alignment = AlignmentType.LEFT;
      indent = { firstLine: 0 };
      spacing = { line: 240, after: 0, before: 0 }; // Espaçamento simples
      bold = false;
    }
    // 3. Data (Direita, 12pt sup)
    else if (/^[a-zA-ZÀ-ÿ\s]+,\s*\{\{.+\}\}/i.test(text) || /^Imperatriz/i.test(text)) {
      alignment = AlignmentType.RIGHT;
      indent = { firstLine: 0 };
      spacing = { line: LINE, before: 240 };
    }
    // 4. Fecho (Sem recuo, 6pt sup)
    else if (text.includes('É o parecer. Submeto à douta consideração superior.')) {
      indent = { firstLine: 0 };
      spacing = { line: LINE, before: 120 }; // 6pt = 120 twips
    }
    // 5. Primeiro parágrafo após título (Sem recuo) - já tratado no index mas reforçado aqui se necessário
    // No Markdown, idx > 0 && blocks[idx-1].type === 'heading' seria o ideal, 
    // mas a lógica atual do markdownToDocxBuffer passa idx.

    return [
      new Paragraph({
        children: [new TextRun({ text, font: FONT, size: SIZE, bold })],
        alignment,
        indent,
        spacing,
      }),
    ];
  }

  if (block.type === 'list') {
    return block.items.map((item, i) =>
      new Paragraph({
        numbering: block.ordered
          ? { reference: 'ordered-list', level: 0 }
          : undefined,
        bullet: block.ordered ? undefined : { level: 0 },
        children: [new TextRun({ text: stripInline(item), font: FONT, size: SIZE })],
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
  const parsed = markdownToTemplateJson(content);
  const filled = replaceVariablesInTemplateJson(parsed, values);

  const raw = filled.blocks
    .map(block => {
      if (block.type === 'heading') {
        const l = block.level;
        return `<h${l}>${blockTextToHtml(block.text)}</h${l}>`;
      }
      if (block.type === 'paragraph') {
        return `<p>${blockTextToHtml(block.text)}</p>`;
      }
      if (block.type === 'list') {
        const tag = block.ordered ? 'ol' : 'ul';
        const items = block.items.map(i => `<li>${blockTextToHtml(i)}</li>`).join('');
        return `<${tag}>${items}</${tag}>`;
      }
      return '';
    })
    .join('\n');

  return normalizeDocumentHtml(raw);
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

  const children = filled.blocks.flatMap((block, idx) => blockToParagraphs(block, idx));

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
