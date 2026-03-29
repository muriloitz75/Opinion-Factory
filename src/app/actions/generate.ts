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
      let standardizedXml = standardizeDocxXml(xml);
      standardizedXml = applyFechoByPositionDocx(standardizedXml);
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
      // Aplicar 6pt de distância do rodapé (w:after="120" no último parágrafo real)
      const pBlocks = injectedContent.match(/<w:p(?: [^>]*)?>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g);
      if (pBlocks && pBlocks.length > 0) {
        const lastP = pBlocks[pBlocks.length - 1];
        let pPr = '';
        const pPrMatch = lastP.match(/<w:pPr(?: [^>]*)>([\s\S]*?)<\/w:pPr>/);
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

    // 2. Localizar o sectPr do mestre e ajustar margens
    const masterSectPrMatch = masterXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    let masterSectPr = masterSectPrMatch ? masterSectPrMatch[0] : '';

    if (masterSectPr) {
      const footerMatch = masterSectPr.match(/w:footer="(\d+)"/);
      const footerVal = footerMatch ? parseInt(footerMatch[1]) : 720;

      // Margem inferior: Footer + 6pt (120 twips)
      const newBottom = footerVal + 120;
      masterSectPr = setXmlTag(masterSectPr, 'w:pgMar', 'w:bottom', newBottom.toString());

      // Margem superior: 12pt (240 twips) após a linha separadora do cabeçalho institucional.
      // Cálculo: w:header(204) + posOffset da linha(1084580 EMU ÷ 635 ≈ 1708 twips) + 12pt(240) = 2152 twips.
      // Garante espaçamento uniforme entre cabeçalho e texto em TODAS as páginas.
      masterSectPr = setXmlTag(masterSectPr, 'w:pgMar', 'w:top', '2152');
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
  // BUG#6 FIX: Isola o conteúdo de tabelas para não processar seus parágrafos internos.
  // Substitui temporariamente blocos <w:tbl>...</w:tbl> por placeholders e os restaura no final.
  const tableBlocks: string[] = [];
  const xmlWithoutTables = xml.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, (tblMatch) => {
    tableBlocks.push(tblMatch);
    return `<!--TBL_PLACEHOLDER_${tableBlocks.length - 1}-->`;
  });

  const processedXml = xmlWithoutTables.replace(/<w:p(?: [^>]*)?>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g, (pMatch) => {
    // Remove tags XML para obter apenas o texto puro do parágrafo
    const text = pMatch.replace(/<[^>]+>/g, '').trim();
    if (!text) return pMatch;

    // Localiza ou inicializa as propriedades do parágrafo (w:pPr)
    let pPr = '';
    const pPrMatch = pMatch.match(/<w:pPr(?: [^>]*)?>([\s\S]*?)<\/w:pPr>/);
    if (pPrMatch) {
      pPr = pPrMatch[0];
    } else {
      pPr = '<w:pPr></w:pPr>';
    }

    let modifiedPPr = pPr;

    // BUG#2 FIX: Regex de data ampliada para capturar datas preenchidas (após render).
    // Formatos suportados: "Cidade, DD de mês de AAAA", "Cidade, DD/MM/AAAA", ou placeholder {{var}}.
    const isDate =
      /^[a-zA-ZÀ-ÿ\s]+,\s*(?:\d{1,2}\s+de\s+[a-zA-ZÀ-ÿ]+\s+de\s+\d{4}|\d{1,2}\/\d{2}\/\d{4}|\{\{.+\}\})/i.test(text);

    // Detecção dos demais blocos legais
    const isParecer = (text.toUpperCase() === 'PARECER' || (text.toUpperCase().startsWith('PARECER') && text.length < 30));
    const isClosing = /submeto à douta consideração superior/i.test(text);
    const isMetadata = /^\s*(PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ|N[º°]|REF|AUTOS|REFERÊNCIA)/i.test(text);
    // Detecta parágrafos com estilo de título do Word (Heading1–6, Título 1–6)
    const isHeading = /<w:pStyle[^>]+w:val="(?:Heading\d+|Heading \d+|T[íi]tulo\s*\d+)"/i.test(pMatch);

    // 1. Parecer (Centralizado)
    if (isParecer) {
      modifiedPPr = setXmlTag(modifiedPPr, 'w:jc', 'w:val', 'center');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:firstLine', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:left', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:right', '0');
      // BUG#3 FIX: Zerar w:hanging para evitar conflito com firstLine=0
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:hanging', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:after', '240');
    }
    // 2. Metadados (Esquerda, Sem recuo, Espaçamento simples)
    else if (isMetadata) {
      modifiedPPr = setXmlTag(modifiedPPr, 'w:jc', 'w:val', 'left');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:firstLine', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:left', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:right', '0');
      // BUG#3 FIX: Zerar w:hanging residual do template
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:hanging', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:line', '360'); // 1,5 (paridade com preview HTML)
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:lineRule', 'auto');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:after', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:before', '0');
    }
    // 3. Data (Direita)
    else if (isDate) {
      modifiedPPr = setXmlTag(modifiedPPr, 'w:jc', 'w:val', 'right');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:firstLine', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:left', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:right', '0');
      // BUG#3 FIX
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:hanging', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:before', '240');
    }
    // 4. Fecho (Sem recuo, 6pt sup)
    else if (isClosing) {
      modifiedPPr = setXmlTag(modifiedPPr, 'w:jc', 'w:val', 'left');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:firstLine', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:left', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:right', '0');
      // BUG#3 FIX
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:hanging', '0');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:before', '160');
    }
    // 5. Títulos de seção (Heading 1–6) — 12pt superior, 8pt inferior
    else if (isHeading) {
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:before', '240');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:after', '160');
    }
    // BUG#1 FIX: Parágrafos normais de corpo — garantir conformidade ABNT
    // firstLine: 1250 twips (1,25cm), justified, espaçamento 1.5 (360 twips)
    else {
      modifiedPPr = setXmlTag(modifiedPPr, 'w:jc', 'w:val', 'both');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:firstLine', '709'); // 1.25cm = ~709 twips (1440/2.54*1.25)
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:left', '0');        // Zera margem esquerda herdada do template
      modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:hanging', '0');    // Zera hanging indent herdado do template
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:line', '360');
      modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:lineRule', 'auto');
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

  // Restaura os blocos de tabela nos seus lugares originais
  return processedXml.replace(/<!--TBL_PLACEHOLDER_(\d+)-->/g, (_, idx) => tableBlocks[parseInt(idx)]);
}


/**
 * Detecta o fecho por posição: o último parágrafo de corpo antes do primeiro parágrafo
 * de data recebe formatação de fecho (sem recuo, alinhado à esquerda, 8pt superior).
 * Só aplica se o parágrafo ainda não tiver w:before="160" (já detectado por conteúdo).
 * Isola tabelas para não considerar parágrafos internos de tabela.
 */
function applyFechoByPositionDocx(xml: string): string {
  // Isola blocos de tabela (mesmo padrão de standardizeDocxXml)
  const tableBlocks: string[] = [];
  const xmlWithoutTables = xml.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, (tblMatch) => {
    tableBlocks.push(tblMatch);
    return `<!--TBL_PLACEHOLDER_${tableBlocks.length - 1}-->`;
  });

  const dateRe = /^[a-zA-ZÀ-ÿ\s]+,\s*(?:\d{1,2}\s+de\s+[a-zA-ZÀ-ÿ]+\s+de\s+\d{4}|\d{1,2}\/\d{2}\/\d{4})/i;
  const metaRe = /^\s*(PROCESSO|INTERESSADO|ASSUNTO|CPF|CNPJ|N[º°]|REF|AUTOS|REFERÊNCIA)/i;

  interface ParaEntry { full: string; index: number; isDate: boolean; isBody: boolean; hasClosingSpacing: boolean }
  const paragraphs: ParaEntry[] = [];
  const pRegex = /<w:p(?: [^>]*)?>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(xmlWithoutTables)) !== null) {
    const full = m[0];
    const text = full.replace(/<[^>]+>/g, '').trim();
    const isHeading = /<w:pStyle[^>]+w:val="(?:Heading\d+|Heading \d+|T[íi]tulo\s*\d+)"/i.test(full);
    const isDate = dateRe.test(text);
    const isMeta = metaRe.test(text);
    const isParecer = text.toUpperCase().startsWith('PARECER') && text.length < 30;
    const hasClosingSpacing = /w:before="160"/.test(full);
    const isBody = !isDate && !isMeta && !isParecer && !isHeading && !!text;
    paragraphs.push({ full, index: m.index, isDate, isBody, hasClosingSpacing });
  }

  const firstDateIdx = paragraphs.findIndex(p => p.isDate);
  if (firstDateIdx <= 0) {
    return xml.replace(/<!--TBL_PLACEHOLDER_(\d+)-->/g, (_, i) => tableBlocks[parseInt(i)]);
  }

  let fechoIdx = -1;
  for (let i = firstDateIdx - 1; i >= 0; i--) {
    if (paragraphs[i].isBody) { fechoIdx = i; break; }
  }

  if (fechoIdx === -1 || paragraphs[fechoIdx].hasClosingSpacing) {
    return xml.replace(/<!--TBL_PLACEHOLDER_(\d+)-->/g, (_, i) => tableBlocks[parseInt(i)]);
  }

  const fechoPara = paragraphs[fechoIdx];
  const pMatch = fechoPara.full;
  let pPr = '';
  const pPrMatch = pMatch.match(/<w:pPr(?: [^>]*)?>([\s\S]*?)<\/w:pPr>/);
  if (pPrMatch) pPr = pPrMatch[0];
  else pPr = '<w:pPr></w:pPr>';

  let modifiedPPr = pPr;
  modifiedPPr = setXmlTag(modifiedPPr, 'w:jc', 'w:val', 'left');
  modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:firstLine', '0');
  modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:left', '0');
  modifiedPPr = setXmlTag(modifiedPPr, 'w:ind', 'w:hanging', '0');
  modifiedPPr = setXmlTag(modifiedPPr, 'w:spacing', 'w:before', '160');

  let newPara: string;
  if (pPrMatch) {
    newPara = pMatch.replace(pPr, modifiedPPr);
  } else {
    newPara = pMatch.replace(/(<w:p(?: [^>]*)?>)/, `$1${modifiedPPr}`);
  }

  const processed =
    xmlWithoutTables.substring(0, fechoPara.index) +
    newPara +
    xmlWithoutTables.substring(fechoPara.index + fechoPara.full.length);

  return processed.replace(/<!--TBL_PLACEHOLDER_(\d+)-->/g, (_, i) => tableBlocks[parseInt(i)]);
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
