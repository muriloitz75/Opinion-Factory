'use server';

import fs from 'fs/promises';
import path from 'path';

export interface Template {
    name: string;
    content: string;
    filename: string;
}

export async function getTemplates(): Promise<Template[]> {
    const docsPath = path.join(process.cwd(), 'Docs');
    try {
        const files = await fs.readdir(docsPath);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        const templates = await Promise.all(
            mdFiles.map(async (file) => {
                const content = await fs.readFile(path.join(docsPath, file), 'utf-8');
                return {
                    name: file.replace('.md', ''),
                    content,
                    filename: file
                };
            })
        );

        return templates;
    } catch (error) {
        console.error('Error reading templates:', error);
        return [];
    }
}
