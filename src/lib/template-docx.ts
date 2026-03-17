import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import mammoth from 'mammoth';
import { normalizeDocumentHtml } from './html-normalize';

/**
 * Extrai nomes de variáveis {{variavel}} do XML bruto do docx.
 * Remove tags XML antes de buscar para lidar com variáveis
 * que o Word eventualmente quebra em múltiplos runs.
 */
export function extractVariablesFromDocx(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const xml = zip.file('word/document.xml')?.asText() ?? '';
  const text = xml.replace(/<[^>]+>/g, '');
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{([^}]+)\}\}/g)) {
    found.add(m[1].trim());
  }
  return [...found];
}

/**
 * Preenche as variáveis no docx com docxtemplater e converte para HTML semântico
 * via mammoth, suprimindo cabeçalhos, rodapés e imagens para um preview limpo.
 */
export async function docxToHtml(
  buffer: Buffer,
  values: Record<string, string>
): Promise<string> {
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
    delimiters: { start: '{{', end: '}}' },
  });

  const safeValues = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v ?? ''])
  );
  doc.render(safeValues);

  const filled = doc.getZip().generate({ type: 'nodebuffer' });

  const { value } = await mammoth.convertToHtml(
    { buffer: filled },
    {
      // Suprime imagens no preview — o documento baixado mantém as originais
      convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })),
      styleMap: [
        // ── Títulos ──────────────────────────────
        "p[style-name='Heading 1']           => h1:fresh",
        "p[style-name='Heading 2']           => h2:fresh",
        "p[style-name='Heading 3']           => h3:fresh",
        "p[style-name='Heading 4']           => h4:fresh",
        "p[style-name='Heading 5']           => h5:fresh",
        "p[style-name='Heading 6']           => h6:fresh",
        "p[style-name='Title']               => h1:fresh",
        "p[style-name='Subtitle']            => h2:fresh",
        "p[style-name='Título 1']            => h1:fresh",
        "p[style-name='Título 2']            => h2:fresh",
        "p[style-name='Título 3']            => h3:fresh",
        "p[style-name='Título 4']            => h4:fresh",
        // ── Parágrafo padrão ─────────────────────
        "p[style-name='Normal']              => p:fresh",
        "p[style-name='Body Text']           => p:fresh",
        "p[style-name='Body Text 2']         => p:fresh",
        "p[style-name='Body Text 3']         => p:fresh",
        "p[style-name='Default Paragraph Style'] => p:fresh",
        "p[style-name='Corpo de Texto']      => p:fresh",
        // ── Parágrafos especiais ─────────────────
        "p[style-name='centered']            => p.abnt-centered:fresh",
        "p[style-name='Center']              => p.abnt-centered:fresh",
        "p[style-name='Centralizado']        => p.abnt-centered:fresh",
        "p[style-name='Quote']               => blockquote:fresh",
        "p[style-name='Intense Quote']       => blockquote:fresh",
        "p[style-name='Citação']             => blockquote:fresh",
        "p[style-name='Citação Direta']      => blockquote:fresh",
        // ── Notas e rodapé textual ───────────────
        "p[style-name='footnote text']       => p.abnt-footnote:fresh",
        "p[style-name='endnote text']        => p.abnt-footnote:fresh",
        // ── Listas ──────────────────────────────
        "p[style-name='List Paragraph']      => p.abnt-list-item:fresh",
        "p[style-name='List Bullet']         => ul > li:fresh",
        "p[style-name='List Number']         => ol > li:fresh",
        "p[style-name='List Bullet 2']       => ul > li:fresh",
        "p[style-name='List Number 2']       => ol > li:fresh",
        // ── Runs ────────────────────────────────
        "r[style-name='Strong']              => strong",
        "r[style-name='Emphasis']            => em",
        // ── Cabeçalhos e rodapés: ignorados ─────
        "p[style-name='header']              => !",
        "p[style-name='footer']              => !",
        "p[style-name='cabeçalho']           => !",
        "p[style-name='rodapé']              => !",
      ],
    }
  );

  return normalizeDocumentHtml(value);
}
