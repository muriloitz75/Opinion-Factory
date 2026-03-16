'use server';

import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';

export async function uploadTemplate(formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) {
        return { success: false, error: 'Arquivo não encontrado' };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const docsPath = path.join(process.cwd(), 'Docs');
    const filePath = path.join(docsPath, file.name.endsWith('.md') ? file.name : `${file.name}.md`);

    try {
        await fs.writeFile(filePath, buffer);
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Error uploading template:', error);
        return { success: false, error: 'Falha ao salvar o arquivo' };
    }
}
