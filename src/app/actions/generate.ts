'use server';

import fs from 'fs/promises';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { markdownToDocxBuffer } from '@/lib/template-markdown';

export async function generateFilledDocx(
  filename: string,
  values: Record<string, string>
): Promise<{ base64: string; error?: string }> {
  try {
    const filePath = path.join(process.cwd(), 'Docs', filename);
    const buffer = await fs.readFile(filePath);
    const safeValues = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v ?? ''])
    );

    if (filename.endsWith('.md')) {
      const content = buffer.toString('utf-8');
      const docxBuffer = await markdownToDocxBuffer(content, safeValues);
      return { base64: docxBuffer.toString('base64') };
    }

    // .docx — pipeline original
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      delimiters: { start: '{{', end: '}}' },
    });
    doc.render(safeValues);

    // Pós-processamento para paridade com Preview (ABNT / Padronização Legal)
    const xml = doc.getZip().file('word/document.xml')?.asText();
    if (xml) {
      const standardizedXml = standardizeDocxXml(xml);
      doc.getZip().file('word/document.xml', standardizedXml);
    }

    const filled = doc.getZip().generate({ type: 'nodebuffer' });
    return { base64: filled.toString('base64') };
  } catch (err) {
    console.error('Erro ao gerar documento:', err);
    return { base64: '', error: 'Falha ao gerar o documento.' };
  }
}

/**
 * Normaliza o XML do Word para garantir que blocos legais tenham o alinhamento 
 * e espaçamento corretos, replicando a lógica do preview HTML.
 */
function standardizeDocxXml(xml: string): string {
  // Regex para identificar parágrafos. Usamos [\s\S]*? para capturar múltiplas linhas.
  return xml.replace(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g, (pMatch) => {
    // Remove tags XML para obter apenas o texto puro do parágrafo
    const text = pMatch.replace(/<[^>]+>/g, '').trim();
    if (!text) return pMatch;

    // Localiza ou inicializa as propriedades do parágrafo (w:pPr)
    let pPr = '';
    const pPrMatch = pMatch.match(/<w:pPr(?: [^>]*)?>[\s\S]*?<\/w:pPr>/);
    if (pPrMatch) {
      pPr = pPrMatch[0];
    } else {
      pPr = '<w:pPr></w:pPr>';
    }

    let modifiedPPr = pPr;

    // Detecção refinada para metadados e blocos legais
    const isParecer = text.toUpperCase().includes('PARECER') && text.length < 150;
    const isMetadata = /(PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ)/i.test(text.slice(0, 100));
    const isClosing = text.includes('É o parecer. Submeto à douta consideração superior.');
    const isDate = /^[a-zA-ZÀ-ÿ\s]+,\s*\{\{.+\}\}/i.test(text) || /^Imperatriz/i.test(text);

    // 1. Parecer (Centralizado)
    if (isParecer) {
      modifiedPPr = setXmlTag(modifiedPPr, 'w:jc', 'w:val', 'center');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:firstLine', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:left', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:right', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:after', '240');
    }
    // 2. Metadados (Esquerda, Sem recuo)
    else if (isMetadata) {
      modifiedPPr = setXmlTag(modifiedPPr, 'w:jc', 'w:val', 'left');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:firstLine', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:left', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:right', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:hanging', '0');
      // Forçar o espaçamento entre linhas e parágrafo limpo
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:after', '0');
    }
    // 3. Data (Direita)
    else if (isDate) {
      modifiedPPr = setXmlTag(modifiedPPr, 'w:jc', 'w:val', 'right');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:firstLine', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:left', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:right', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:before', '240');
    }
    // 4. Fecho (Sem recuo, 6pt sup)
    else if (isClosing) {
      modifiedPPr = setXmlTag(modifiedPPr, 'w:jc', 'w:val', 'left');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:firstLine', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:left', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:right', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:before', '120');
    }

    if (modifiedPPr !== pPr) {
      if (pPrMatch) {
        return pMatch.split(pPr).join(modifiedPPr);
      } else {
        return pMatch.replace(/(<w:p(?: [^>]*)?>)/, `$1${modifiedPPr}`);
      }
    }

    return pMatch;
  });
}

/**
 * Função utilitária para injetar ou atualizar tags de propriedade no XML.
 */
function setXmlTag(pPr: string, tagName: string, attrName: string, value: string): string {
  // Regex mais robusta para encontrar a tag, mesmo que ela tenha outros atributos
  const tagNameEscaped = tagName.replace(':', '\\:');
  const reg = new RegExp(`<${tagNameEscaped}[^>]*?>`, 'i');
  const tagMatch = pPr.match(reg);

  if (tagMatch) {
    const tag = tagMatch[0];
    const attrReg = new RegExp(`${attrName}="[^"]*"`, 'i');
    if (attrReg.test(tag)) {
      // Atualiza o atributo existente na tag
      const newTag = tag.replace(attrReg, `${attrName}="${value}"`);
      return pPr.replace(tag, newTag);
    } else {
      // Adiciona o atributo à tag existente (antes de /> ou >)
      const newTag = tag.replace(/(\/?>)$/, ` ${attrName}="${value}"$1`);
      return pPr.replace(tag, newTag);
    }
  } else {
    // Insere nova tag completa antes do fechamento de w:pPr
    const newTag = `<${tagName} ${attrName}="${value}"/>`;
    return pPr.replace('</w:pPr>', `${newTag}</w:pPr>`);
  }
}
