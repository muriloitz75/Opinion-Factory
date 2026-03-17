'use server';

import fs from 'fs/promises';
import path from 'path';
import { docxToHtml } from '@/lib/template-docx';
import { markdownToHtml } from '@/lib/template-markdown';

export async function renderTemplate(
  filename: string,
  values: Record<string, string>
): Promise<{ html: string; error?: string }> {
  try {
    const filePath = path.join(process.cwd(), 'Docs', filename);
    const buffer = await fs.readFile(filePath);

    if (filename.endsWith('.md')) {
      const html = markdownToHtml(buffer.toString('utf-8'), values);
      return { html };
    }

    // .docx — mammoth converte apenas o corpo do documento (sem cabeçalho/rodapé/imagens)
    const html = await docxToHtml(buffer, values);
    return { html };
  } catch (err) {
    console.error('Erro ao renderizar template:', err);
    return { html: '', error: 'Falha ao renderizar o documento.' };
  }
}
