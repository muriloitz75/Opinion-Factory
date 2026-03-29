import { describe, it, expect } from 'vitest';
import { normalizeDocumentHtml } from '../html-normalize';

describe('normalizeDocumentHtml', () => {
  it('retorna HTML vazio sem modificação', () => {
    expect(normalizeDocumentHtml('')).toBe('');
    expect(normalizeDocumentHtml('   ')).toBe('   ');
  });

  it('preserva parágrafo normal', () => {
    const result = normalizeDocumentHtml('<p>Texto simples.</p>');
    expect(result).toContain('Texto simples.');
  });

  it('remove parágrafos vazios', () => {
    const result = normalizeDocumentHtml('<p></p><p>Texto.</p>');
    expect(result).not.toContain('<p></p>');
    expect(result).toContain('Texto.');
  });

  it('remove parágrafos com apenas &nbsp;', () => {
    const result = normalizeDocumentHtml('<p>&nbsp;</p><p>Conteúdo.</p>');
    expect(result).not.toMatch(/<p>\s*<\/p>/);
  });

  it('parágrafo PARECER recebe classe abnt-centered', () => {
    const result = normalizeDocumentHtml('<p>PARECER</p>');
    expect(result).toContain('abnt-centered');
  });

  it('parágrafo PARECER com texto curto recebe classe abnt-centered', () => {
    const result = normalizeDocumentHtml('<p>PARECER FISCAL Nº 001</p>');
    expect(result).toContain('abnt-centered');
  });

  it('parágrafo de metadados PROCESSO recebe classe abnt-no-indent', () => {
    const result = normalizeDocumentHtml('<p>PROCESSO: 001/2025</p>');
    expect(result).toContain('abnt-no-indent');
  });

  it('parágrafo de metadados INTERESSADO recebe classe abnt-no-indent', () => {
    const result = normalizeDocumentHtml('<p>INTERESSADO: João Silva</p>');
    expect(result).toContain('abnt-no-indent');
  });

  it('parágrafo de metadados ASSUNTO recebe classe abnt-no-indent', () => {
    const result = normalizeDocumentHtml('<p>ASSUNTO: ICMS</p>');
    expect(result).toContain('abnt-no-indent');
  });

  it('parágrafo de data recebe classe abnt-right', () => {
    const result = normalizeDocumentHtml('<p>Imperatriz, 01 de janeiro de 2025</p>');
    expect(result).toContain('abnt-right');
  });

  it('parágrafo de fecho recebe classe abnt-closing', () => {
    const result = normalizeDocumentHtml('<p>É o parecer. Submeto à douta consideração superior.</p>');
    expect(result).toContain('abnt-closing');
  });

  it('promove <p><strong>CONCLUSÃO</strong></p> para heading', () => {
    const result = normalizeDocumentHtml('<p><strong>CONCLUSÃO</strong></p>');
    expect(result).toMatch(/<h[1-6]>CONCLUSÃO<\/h[1-6]>/i);
  });

  it('não promove <p><strong>texto em minúsculas</strong></p> para heading', () => {
    const result = normalizeDocumentHtml('<p><strong>texto normal</strong></p>');
    expect(result).not.toMatch(/<h[1-6]/);
  });

  it('deduplica headings consecutivos idênticos', () => {
    const result = normalizeDocumentHtml('<h2>TÍTULO</h2><h2>TÍTULO</h2>');
    const matches = result.match(/<h2>TÍTULO<\/h2>/gi) ?? [];
    expect(matches.length).toBe(1);
  });

  it('remove spans sem atributos', () => {
    const result = normalizeDocumentHtml('<p><span>texto</span></p>');
    expect(result).not.toContain('<span>');
    expect(result).toContain('texto');
  });

  it('substitui &nbsp; por espaço normal', () => {
    const result = normalizeDocumentHtml('<p>texto&nbsp;aqui</p>');
    expect(result).not.toContain('&nbsp;');
    expect(result).toContain('texto aqui');
  });

  it('agrupa listas consecutivas <ul><li> em uma única <ul>', () => {
    const result = normalizeDocumentHtml('<ul><li>a</li></ul><ul><li>b</li></ul>');
    const ulCount = (result.match(/<ul>/gi) ?? []).length;
    expect(ulCount).toBe(1);
  });
});
