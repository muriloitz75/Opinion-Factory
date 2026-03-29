import { describe, it, expect } from 'vitest';
import {
  blockTextToHtml,
  markdownToTemplateJson,
  extractVariablesFromTemplateJson,
  replaceVariablesInTemplateJson,
  TemplateJsonDocument,
} from '../template-json';

// ── blockTextToHtml ────────────────────────────────────────────

describe('blockTextToHtml', () => {
  it('retorna string vazia para entrada vazia', () => {
    expect(blockTextToHtml('')).toBe('');
  });

  it('converte **bold** em <strong>', () => {
    expect(blockTextToHtml('**negrito**')).toBe('<strong>negrito</strong>');
  });

  it('converte __bold__ em <strong>', () => {
    expect(blockTextToHtml('__negrito__')).toBe('<strong>negrito</strong>');
  });

  it('converte `code` em <code>', () => {
    expect(blockTextToHtml('`código`')).toBe('<code>código</code>');
  });

  it('escapa & como &amp;', () => {
    expect(blockTextToHtml('A & B')).toBe('A &amp; B');
  });

  it('escapa < como &lt;', () => {
    expect(blockTextToHtml('a < b')).toBe('a &lt; b');
  });

  it('escapa > como &gt;', () => {
    expect(blockTextToHtml('a > b')).toBe('a &gt; b');
  });

  it('converte quebra de linha em <br />', () => {
    expect(blockTextToHtml('linha1\nlinha2')).toBe('linha1<br />linha2');
  });

  it('mantém texto simples sem modificar', () => {
    expect(blockTextToHtml('texto simples')).toBe('texto simples');
  });
});

// ── markdownToTemplateJson ─────────────────────────────────────

describe('markdownToTemplateJson', () => {
  it('retorna documento com blocos vazios para markdown vazio', () => {
    const doc = markdownToTemplateJson('');
    expect(doc.blocks).toEqual([]);
  });

  it('converte heading # em bloco de tipo heading nível 1', () => {
    const doc = markdownToTemplateJson('# Título Principal\n');
    const headings = doc.blocks.filter(b => b.type === 'heading');
    expect(headings).toHaveLength(1);
    expect(headings[0]).toMatchObject({ type: 'heading', level: 1 });
  });

  it('converte ## em heading nível 2', () => {
    const doc = markdownToTemplateJson('## Subtítulo\n');
    expect(doc.blocks[0]).toMatchObject({ type: 'heading', level: 2 });
  });

  it('converte seção numerada em negrito "1. **TÍTULO**" em heading nível 2', () => {
    const doc = markdownToTemplateJson('1. **DO FATO**\n');
    const headings = doc.blocks.filter(b => b.type === 'heading');
    expect(headings).toHaveLength(1);
    expect(headings[0]).toMatchObject({ type: 'heading', level: 2 });
  });

  it('converte lista com "-" em bloco list não-ordenado', () => {
    const doc = markdownToTemplateJson('- item 1\n- item 2\n');
    const lists = doc.blocks.filter(b => b.type === 'list');
    expect(lists).toHaveLength(1);
    if (lists[0].type === 'list') {
      expect(lists[0].ordered).toBe(false);
      expect(lists[0].items).toHaveLength(2);
    }
  });

  it('converte lista ordenada em bloco list ordenado', () => {
    const doc = markdownToTemplateJson('1. primeiro\n2. segundo\n');
    const lists = doc.blocks.filter(b => b.type === 'list');
    expect(lists).toHaveLength(1);
    if (lists[0].type === 'list') {
      expect(lists[0].ordered).toBe(true);
    }
  });

  it('converte parágrafo normal em bloco de tipo paragraph', () => {
    const doc = markdownToTemplateJson('Este é um parágrafo.\n');
    const paragraphs = doc.blocks.filter(b => b.type === 'paragraph');
    expect(paragraphs.length).toBeGreaterThan(0);
  });

  it('mantém placeholder {{x}} intacto no bloco', () => {
    const doc = markdownToTemplateJson('Nome: {{nomeContribuinte}}\n');
    const paragraphs = doc.blocks.filter(b => b.type === 'paragraph');
    expect(paragraphs.some(p => p.type === 'paragraph' && p.text.includes('{{nomeContribuinte}}'))).toBe(true);
  });

  it('documento com apenas headings não gera blocos paragraph', () => {
    const doc = markdownToTemplateJson('# Título\n## Subtítulo\n');
    const paragraphs = doc.blocks.filter(b => b.type === 'paragraph');
    expect(paragraphs).toHaveLength(0);
  });
});

// ── extractVariablesFromTemplateJson ──────────────────────────

describe('extractVariablesFromTemplateJson', () => {
  it('retorna array vazio para documento sem variáveis', () => {
    const doc: TemplateJsonDocument = {
      blocks: [{ type: 'paragraph', text: 'Texto simples.' }],
    };
    expect(extractVariablesFromTemplateJson(doc)).toEqual([]);
  });

  it('extrai variável de bloco paragraph', () => {
    const doc: TemplateJsonDocument = {
      blocks: [{ type: 'paragraph', text: 'Nome: {{nome}}' }],
    };
    expect(extractVariablesFromTemplateJson(doc)).toContain('nome');
  });

  it('extrai variável de bloco heading', () => {
    const doc: TemplateJsonDocument = {
      blocks: [{ type: 'heading', level: 1, text: 'PARECER {{numero}}' }],
    };
    expect(extractVariablesFromTemplateJson(doc)).toContain('numero');
  });

  it('extrai variáveis de itens de lista', () => {
    const doc: TemplateJsonDocument = {
      blocks: [{ type: 'list', ordered: false, items: ['Item {{item1}}', 'Item {{item2}}'] }],
    };
    const vars = extractVariablesFromTemplateJson(doc);
    expect(vars).toContain('item1');
    expect(vars).toContain('item2');
  });

  it('deduplica variáveis repetidas em múltiplos blocos', () => {
    const doc: TemplateJsonDocument = {
      blocks: [
        { type: 'paragraph', text: '{{nome}}' },
        { type: 'paragraph', text: 'Novamente {{nome}}' },
      ],
    };
    const vars = extractVariablesFromTemplateJson(doc);
    expect(vars.filter(v => v === 'nome')).toHaveLength(1);
  });

  it('retorna array vazio para documento sem blocos', () => {
    const doc: TemplateJsonDocument = { blocks: [] };
    expect(extractVariablesFromTemplateJson(doc)).toEqual([]);
  });
});

// ── replaceVariablesInTemplateJson ─────────────────────────────

describe('replaceVariablesInTemplateJson', () => {
  it('substitui variável em bloco paragraph', () => {
    const doc: TemplateJsonDocument = {
      blocks: [{ type: 'paragraph', text: 'Olá {{nome}}!' }],
    };
    const result = replaceVariablesInTemplateJson(doc, { nome: 'Maria' });
    expect(result.blocks[0]).toMatchObject({ type: 'paragraph', text: 'Olá Maria!' });
  });

  it('substitui variável em bloco heading', () => {
    const doc: TemplateJsonDocument = {
      blocks: [{ type: 'heading', level: 1, text: 'PARECER {{numero}}' }],
    };
    const result = replaceVariablesInTemplateJson(doc, { numero: '001/2025' });
    if (result.blocks[0].type === 'heading') {
      expect(result.blocks[0].text).toBe('PARECER 001/2025');
    }
  });

  it('substitui variável em itens de lista', () => {
    const doc: TemplateJsonDocument = {
      blocks: [{ type: 'list', ordered: false, items: ['Contribuinte: {{nome}}'] }],
    };
    const result = replaceVariablesInTemplateJson(doc, { nome: 'João' });
    if (result.blocks[0].type === 'list') {
      expect(result.blocks[0].items[0]).toBe('Contribuinte: João');
    }
  });

  it('mantém placeholder quando variável ausente no values', () => {
    const doc: TemplateJsonDocument = {
      blocks: [{ type: 'paragraph', text: '{{nome}} {{cpf}}' }],
    };
    const result = replaceVariablesInTemplateJson(doc, { nome: 'João' });
    if (result.blocks[0].type === 'paragraph') {
      expect(result.blocks[0].text).toContain('{{cpf}}');
    }
  });

  it('mantém placeholder quando valor é string vazia', () => {
    const doc: TemplateJsonDocument = {
      blocks: [{ type: 'paragraph', text: '{{nome}}' }],
    };
    const result = replaceVariablesInTemplateJson(doc, { nome: '' });
    if (result.blocks[0].type === 'paragraph') {
      expect(result.blocks[0].text).toBe('{{nome}}');
    }
  });

  it('não modifica o documento original (imutabilidade)', () => {
    const doc: TemplateJsonDocument = {
      blocks: [{ type: 'paragraph', text: '{{nome}}' }],
    };
    const original = JSON.stringify(doc);
    replaceVariablesInTemplateJson(doc, { nome: 'João' });
    expect(JSON.stringify(doc)).toBe(original);
  });

  it('retorna documento com blocos vazios quando entrada não tem blocos', () => {
    const doc: TemplateJsonDocument = { blocks: [] };
    const result = replaceVariablesInTemplateJson(doc, { nome: 'Maria' });
    expect(result.blocks).toEqual([]);
  });
});
