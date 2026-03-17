'use server';

import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { extractVariablesFromDocx } from '@/lib/template-docx';
import { extractVariablesFromMarkdown } from '@/lib/template-markdown';

const DOCS_PATH = () => path.join(process.cwd(), 'Docs');

export async function uploadTemplate(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) return { success: false, error: 'Arquivo não encontrado' };

  const name = file.name.toLowerCase();
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (name.endsWith('.docx')) {
    try {
      extractVariablesFromDocx(buffer);
    } catch {
      return { success: false, error: 'Arquivo .docx inválido ou corrompido' };
    }
    const baseName = path.basename(file.name, '.docx');
    await fs.writeFile(path.join(DOCS_PATH(), `${baseName}.docx`), buffer);
  } else if (name.endsWith('.md')) {
    const content = buffer.toString('utf-8');
    try {
      extractVariablesFromMarkdown(content);
    } catch {
      return { success: false, error: 'Arquivo .md inválido' };
    }
    const baseName = path.basename(file.name, '.md');
    await fs.writeFile(path.join(DOCS_PATH(), `${baseName}.md`), buffer);
  } else {
    return { success: false, error: 'Apenas arquivos .docx ou .md são aceitos' };
  }

  revalidatePath('/');
  return { success: true };
}

function extractGoogleDocId(url: string): string | null {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function importFromGoogleDocs(
  url: string
): Promise<{ success: boolean; error?: string; name?: string }> {
  const docId = extractGoogleDocId(url.trim());
  if (!docId) {
    return {
      success: false,
      error: 'URL inválida. Use um link de Google Docs com /document/d/{ID}/',
    };
  }

  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=docx`;

  let response: Response;
  try {
    response = await fetch(exportUrl, { redirect: 'follow' });
  } catch {
    return { success: false, error: 'Falha ao conectar. Verifique sua conexão.' };
  }

  if (!response.ok) {
    return {
      success: false,
      error: 'Documento não acessível. Verifique se está compartilhado publicamente (Qualquer pessoa com o link).',
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Tenta extrair o nome do cabeçalho content-disposition
  const disposition = response.headers.get('content-disposition') ?? '';
  const nameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\r\n]+)/i);
  let docName = nameMatch
    ? decodeURIComponent(nameMatch[1].replace(/"/g, '').trim())
    : `gdoc-${docId}`;
  docName = docName.replace(/\.docx$/i, '').replace(/[^\w\s\u00C0-\u024F-]/g, '').trim() || `gdoc-${docId}`;

  try {
    extractVariablesFromDocx(buffer);
  } catch {
    return { success: false, error: 'Falha ao processar o documento exportado.' };
  }

  await fs.writeFile(path.join(DOCS_PATH(), `${docName}.docx`), buffer);
  revalidatePath('/');
  return { success: true, name: docName };
}
