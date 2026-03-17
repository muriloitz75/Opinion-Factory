import fs from 'fs/promises';
import path from 'path';

function markdownToTemplateJson(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  const paragraphBuffer = [];

  const flushParagraph = () => {
    const text = paragraphBuffer.join('').trim();
    if (text.length > 0) {
      blocks.push({ type: 'paragraph', text });
    }
    paragraphBuffer.length = 0;
  };

  const appendParagraphLine = (line) => {
    const trimmedRight = line.replace(/\s+$/, '');
    const hasHardBreak = / {2,}$/.test(line) || /\\$/.test(trimmedRight);
    const cleaned = trimmedRight.replace(/\\$/, '').trim();
    if (!cleaned) return;
    paragraphBuffer.push(cleaned);
    paragraphBuffer.push(hasHardBreak ? '\n' : ' ');
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      blocks.push({ type: 'heading', level, text: headingMatch[2].trim() });
      i += 1;
      continue;
    }

    const numberedBoldSectionMatch = line.match(/^\s*(\d+)\.\s+\*\*([^*\n]+)\*\*\s*$/);
    if (numberedBoldSectionMatch) {
      flushParagraph();
      blocks.push({ type: 'heading', level: 2, text: `${numberedBoldSectionMatch[1]}. ${numberedBoldSectionMatch[2].trim()}` });
      i += 1;
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const ordered = Boolean(orderedMatch);
      const items = [];
      while (i < lines.length) {
        const currentLine = lines[i];
        const itemMatch = ordered
          ? currentLine.match(/^\s*\d+[.)]\s+(.+)$/)
          : currentLine.match(/^\s*[-*+]\s+(.+)$/);
        if (!itemMatch) break;
        let itemText = itemMatch[1].trim();
        let j = i + 1;
        while (j < lines.length) {
          const continuation = lines[j];
          if (!continuation.trim()) break;
          if (/^\s{2,}\S+/.test(continuation)) {
            itemText += ` ${continuation.trim()}`;
            j += 1;
            continue;
          }
          break;
        }
        items.push(itemText);
        i = j;
      }
      if (items.length > 0) {
        blocks.push({ type: 'list', ordered, items });
      }
      continue;
    }

    appendParagraphLine(line);
    i += 1;
  }

  flushParagraph();
  return { blocks };
}

async function migrate() {
  const docsDir = path.join(process.cwd(), 'Docs');
  const files = await fs.readdir(docsDir);
  const mdFiles = files.filter(file => file.endsWith('.md'));

  for (const mdFile of mdFiles) {
    const mdPath = path.join(docsDir, mdFile);
    const jsonPath = path.join(docsDir, `${path.basename(mdFile, '.md')}.json`);
    const markdown = await fs.readFile(mdPath, 'utf-8');
    const templateJson = markdownToTemplateJson(markdown);
    await fs.writeFile(jsonPath, JSON.stringify(templateJson, null, 2), 'utf-8');
  }

  console.log(`Migrados ${mdFiles.length} arquivo(s) .md para .json em ${docsDir}`);
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
