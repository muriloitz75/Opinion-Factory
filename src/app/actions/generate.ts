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
      const filledBuffer = await markdownToDocxBuffer(content, safeValues);
      const finalBuffer = await applyMasterEnvelope(filledBuffer);
      return { base64: finalBuffer.toString('base64') };
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

    // 1. Padronização ABNT/Legal do conteúdo preenchido
    const xml = doc.getZip().file('word/document.xml')?.asText();
    if (xml) {
      const standardizedXml = standardizeDocxXml(xml);
      doc.getZip().file('word/document.xml', standardizedXml);
    }

    const filledBuffer = doc.getZip().generate({ type: 'nodebuffer' });
    
    // 2. Aplicação do Envelope (Template Mestre)
    const finalBuffer = await applyMasterEnvelope(filledBuffer);
    return { base64: finalBuffer.toString('base64') };
  } catch (err) {
    console.error('Erro ao gerar documento:', err);
    return { base64: '', error: 'Falha ao gerar o documento.' };
  }
}

/**
 * Envelopa o conteúdo de um DOCX preenchido dentro do arquivo Docs/Modelo.docx.
 * Preserva cabeçalhos, rodapés e margens do mestre.
 */
async function applyMasterEnvelope(contentBuffer: Buffer): Promise<Buffer> {
  try {
    const masterPath = path.join(process.cwd(), 'model', 'modelo.docx');
    const masterBuffer = await fs.readFile(masterPath);
    const masterZip = new PizZip(masterBuffer);
    const masterXml = masterZip.file('word/document.xml')?.asText();
    
    if (!masterXml) return contentBuffer;

    const contentZip = new PizZip(contentBuffer);
    const contentXml = contentZip.file('word/document.xml')?.asText() || '';
    
    // Extrai blocos de conteúdo do body (parágrafos e tabelas)
    const contentMatch = contentXml.match(/<w:body>([\s\S]*?)(?:<w:sectPr[\s\S]*?<\/w:sectPr>)?<\/w:body>/);
    let injectedContent = contentMatch ? contentMatch[1] : '';

    if (injectedContent) {
      // 1. Aplicar 12pt de distância do cabeçalho (w:before="240" no primeiro parágrafo)
      injectedContent = injectedContent.replace(/<w:p(?: [^>]*)?>/, (match) => {
        let pPr = '';
        const pPrMatch = match.match(/<w:pPr(?: [^>]*)?>[\s\S]*?<\/w:pPr>/);
        if (pPrMatch) pPr = pPrMatch[0];
        else pPr = '<w:pPr></w:pPr>';

        const modifiedPPr = setXmlTag(pPr, 'w:spacing', 'w:before', '240');
        
        if (pPrMatch) return match.replace(pPr, modifiedPPr);
        return match.replace(/(<w:p(?: [^>]*)?>)/, `$1${modifiedPPr}`);
      });

      // 2. Aplicar 6pt de distância do rodapé (w:after="120" no último parágrafo)
      const pBlocks = injectedContent.match(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g);
      if (pBlocks && pBlocks.length > 0) {
        const lastP = pBlocks[pBlocks.length - 1];
        let pPr = '';
        const pPrMatch = lastP.match(/<w:pPr(?: [^>]*)?>[\s\S]*?<\/w:pPr>/);
        if (pPrMatch) pPr = pPrMatch[0];
        else pPr = '<w:pPr></w:pPr>';

        const modifiedPPr = setXmlTag(pPr, 'w:spacing', 'w:after', '120');
        
        let newLastP = '';
        if (pPrMatch) newLastP = lastP.replace(pPr, modifiedPPr);
        else newLastP = lastP.replace(/(<w:p(?: [^>]*)?>)/, `$1${modifiedPPr}`);
        
        const lastIndex = injectedContent.lastIndexOf(lastP);
        injectedContent = injectedContent.substring(0, lastIndex) + newLastP + injectedContent.substring(lastIndex + lastP.length);
      }
    }

    // 2. Localizar o sectPr do mestre e ajustar MARGEM INFERIOR para 6pt (120 twips)
    let masterSectPrMatch = masterXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    let masterSectPr = masterSectPrMatch ? masterSectPrMatch[0] : '';

    if (masterSectPr) {
      const footerMatch = masterSectPr.match(/w:footer="(\d+)"/);
      const footerVal = footerMatch ? parseInt(footerMatch[1]) : 720;

      // Cálculo do novo limite inferior: Footer + 6pt (120 twips)
      const newBottom = footerVal + 120;

      // Injeta APENAS a nova margem inferior no sectPr do mestre
      // Mantemos o w:top original para não sobrepor o cabeçalho
      masterSectPr = setXmlTag(masterSectPr, 'w:pgMar', 'w:bottom', newBottom.toString());
    }

    // 3. Montar o novo document.xml do mestre:
    const newMasterXml = masterXml.replace(
      /<w:body>[\s\S]*?<\/w:body>/,
      `<w:body>${injectedContent}${masterSectPr}</w:body>`
    );

    masterZip.file('word/document.xml', newMasterXml);
    return masterZip.generate({ type: 'nodebuffer' });
  } catch (err) {
    console.warn('Processamento de Envelope: Modelo.docx não encontrado ou erro. Usando conteúdo puro.', err);
    return contentBuffer;
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
    const isParecer = (text.toUpperCase() === 'PARECER' || (text.toUpperCase().startsWith('PARECER') && text.length < 30));
    const isMetadata = /^(PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ|N[º°])/i.test(text);
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
