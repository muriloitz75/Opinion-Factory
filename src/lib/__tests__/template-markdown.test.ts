import { describe, it, expect } from 'vitest';
import { markdownToHtml, extractVariablesFromMarkdown } from '../template-markdown';

describe('markdownToHtml', () => {
  it('retorna HTML para markdown simples', () => {
    const result = markdownToHtml('Texto simples.\n', {});
    expect(result).toContain('Texto simples.');
    expect(result).toContain('<p');
  });

  it('converte heading em tag h', () => {
    const result = markdownToHtml('# Título\n', {});
    expect(result).toContain('<h1>');
  });

  it('substitui variável preenchida por span com classe var-filled', () => {
    const result = markdownToHtml('Nome: {{nome}}\n', { nome: 'Maria' });
    expect(result).toContain('class="var-filled"');
    expect(result).toContain('Maria');
  });

  it('mantém placeholder quando variável não está em values', () => {
    const result = markdownToHtml('CPF: {{cpf}}\n', {});
    expect(result).toContain('{{cpf}}');
  });

  it('escapa caracteres especiais no valor da variável substituída', () => {
    const result = markdownToHtml('{{dado}}\n', { dado: '<script>' });
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('converte lista em ul/li', () => {
    const result = markdownToHtml('- item 1\n- item 2\n', {});
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });

  it('aplica normalização ABNT (parágrafo PARECER → abnt-centered)', () => {
    const result = markdownToHtml('PARECER FISCAL\n', {});
    expect(result).toContain('abnt-centered');
  });

  it('retorna HTML vazio/mínimo para markdown vazio', () => {
    const result = markdownToHtml('', {});
    expect(result.trim()).toBe('');
  });
});

describe('extractVariablesFromMarkdown', () => {
  it('extrai variáveis de markdown com variáveis', () => {
    const result = extractVariablesFromMarkdown('Nome: {{nome}}, CPF: {{cpf}}\n');
    expect(result).toContain('nome');
    expect(result).toContain('cpf');
  });

  it('retorna array vazio para markdown sem variáveis', () => {
    expect(extractVariablesFromMarkdown('Texto sem variáveis.\n')).toEqual([]);
  });

  it('retorna array vazio para markdown vazio', () => {
    expect(extractVariablesFromMarkdown('')).toEqual([]);
  });

  it('deduplica variáveis repetidas', () => {
    const result = extractVariablesFromMarkdown('{{x}} e {{x}}\n');
    expect(result.filter(v => v === 'x')).toHaveLength(1);
  });
});
