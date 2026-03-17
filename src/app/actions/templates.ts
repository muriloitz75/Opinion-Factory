'use server';

import fs from 'fs/promises';
import path from 'path';
import { extractVariablesFromDocx } from '@/lib/template-docx';
import { extractVariablesFromMarkdown } from '@/lib/template-markdown';

export interface Template {
  name: string;
  filename: string;
  variables: string[];
  type: 'docx' | 'markdown';
}

const DOCS_PATH = () => path.join(process.cwd(), 'Docs');
const SUPPORTED = ['.docx', '.md'] as const;

export async function getTemplates(): Promise<Template[]> {
  try {
    const files = await fs.readdir(DOCS_PATH());
    const supported = files.filter(f => SUPPORTED.some(ext => f.endsWith(ext)));
    const templates: Template[] = [];

    for (const file of supported) {
      try {
        const buffer = await fs.readFile(path.join(DOCS_PATH(), file));

        if (file.endsWith('.docx')) {
          const variables = extractVariablesFromDocx(buffer);
          templates.push({
            name: file.replace(/\.docx$/i, ''),
            filename: file,
            variables,
            type: 'docx',
          });
        } else if (file.endsWith('.md')) {
          const variables = extractVariablesFromMarkdown(buffer.toString('utf-8'));
          templates.push({
            name: file.replace(/\.md$/i, ''),
            filename: file,
            variables,
            type: 'markdown',
          });
        }
      } catch {
        // Ignora arquivos corrompidos
      }
    }

    return templates.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function deleteTemplate(
  filename: string
): Promise<{ success: boolean; error?: string }> {
  const isSupported = SUPPORTED.some(ext => filename.endsWith(ext));
  if (!isSupported) {
    return { success: false, error: 'Formato de modelo inválido' };
  }

  const filePath = path.join(DOCS_PATH(), filename);
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch {
    return { success: false, error: 'Falha ao excluir modelo' };
  }
}
