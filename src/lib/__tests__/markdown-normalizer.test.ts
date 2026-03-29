import { describe, it, expect } from 'vitest';
import { normalizeMarkdown, isMarkdownNormalized } from '../markdown-normalizer';

describe('normalizeMarkdown', () => {
  it('retorna string vazia para entrada vazia', () => {
    expect(normalizeMarkdown('')).toBe('');
  });

  it('colapsa múltiplas linhas em branco consecutivas em uma única', () => {
    const input = 'Parágrafo um.\n\n\n\nParágrafo dois.\n';
    const result = normalizeMarkdown(input);
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('isola PARECER com linha em branco antes e depois', () => {
    const input = 'Texto acima\nPARECER FISCAL Nº 001\nTexto abaixo\n';
    const result = normalizeMarkdown(input);
    expect(result).toMatch(/\n\nPARECER FISCAL Nº 001\n\n/);
  });

  it('isola heading com linha em branco antes e depois', () => {
    const input = 'Parágrafo.\n## DO FATO\nTexto.\n';
    const result = normalizeMarkdown(input);
    expect(result).toMatch(/\n\n## DO FATO\n\n/);
  });

  it('isola linha de metadados (PROCESSO) com linha em branco antes e depois', () => {
    const input = 'Acima.\nPROCESSO: 1234\nAbaixo.\n';
    const result = normalizeMarkdown(input);
    expect(result).toMatch(/\n\nPROCESSO: 1234\n\n/);
  });

  it('isola linha de data com linha em branco antes e depois', () => {
    const input = 'Texto.\nImperatriz, 01 de janeiro de 2025\nMais texto.\n';
    const result = normalizeMarkdown(input);
    expect(result).toMatch(/\n\nImperatriz, 01 de janeiro de 2025\n\n/);
  });

  it('isola fecho jurídico com linha em branco antes e depois', () => {
    const input = 'Texto.\nSubmeto à douta consideração superior.\nFim.\n';
    const result = normalizeMarkdown(input);
    expect(result).toMatch(/\n\nSubmeto à douta consideração superior\.\n\n/);
  });

  it('não começa com linha em branco', () => {
    const result = normalizeMarkdown('\n\nTexto.\n');
    expect(result).not.toMatch(/^\n/);
  });

  it('termina com exatamente um \\n', () => {
    const result = normalizeMarkdown('Texto.');
    expect(result).toMatch(/[^\n]\n$/);
  });

  it('normaliza CRLF para LF', () => {
    const result = normalizeMarkdown('Linha um\r\nLinha dois\r\n');
    expect(result).not.toContain('\r');
  });

  it('preserva conteúdo de corpo sem modificar o texto', () => {
    const input = 'Este é um parágrafo normal de texto.\n';
    const result = normalizeMarkdown(input);
    expect(result).toContain('Este é um parágrafo normal de texto.');
  });

  it('preserva hard-break (dois espaços no final) como exatamente dois espaços', () => {
    const result = normalizeMarkdown('Linha com break  \nContinuação.\n');
    expect(result).toMatch(/break  \n/);
  });
});

describe('isMarkdownNormalized', () => {
  it('retorna false quando há múltiplas linhas em branco consecutivas', () => {
    expect(isMarkdownNormalized('A\n\n\nB\n')).toBe(false);
  });

  it('retorna false quando PARECER não está isolado', () => {
    expect(isMarkdownNormalized('Texto\nPARECER\nTexto\n')).toBe(false);
  });

  it('retorna true para conteúdo já normalizado (passagem dupla idempotente)', () => {
    const input = 'Texto inicial.\n';
    const normalized = normalizeMarkdown(input);
    expect(isMarkdownNormalized(normalized)).toBe(true);
  });
});
