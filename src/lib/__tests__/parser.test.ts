import { describe, it, expect } from 'vitest';
import { extractVariables, replaceVariables } from '../parser';

describe('extractVariables', () => {
  it('extrai variáveis únicas de um template simples', () => {
    const result = extractVariables('Olá {{nome}}, seu CPF é {{cpf}}.');
    expect(result.map(v => v.name)).toEqual(['nome', 'cpf']);
  });

  it('retorna array vazio para string sem variáveis', () => {
    expect(extractVariables('Texto simples sem variáveis.')).toEqual([]);
  });

  it('retorna array vazio para string vazia', () => {
    expect(extractVariables('')).toEqual([]);
  });

  it('deduplica variáveis repetidas', () => {
    const result = extractVariables('{{nome}} e novamente {{nome}}');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('nome');
  });

  it('detecta type=date quando nome contém "data"', () => {
    const result = extractVariables('{{dataInicio}} e {{dataFim}}');
    expect(result.every(v => v.type === 'date')).toBe(true);
  });

  it('detecta type=text para variável sem "data" no nome', () => {
    const result = extractVariables('{{nomeContribuinte}}');
    expect(result[0].type).toBe('text');
  });

  it('gera label legível a partir do nome em camelCase', () => {
    const result = extractVariables('{{nomeContribuinte}}');
    expect(result[0].label).toBe('Nome Contribuinte');
  });

  it('remove espaços ao redor do nome da variável', () => {
    const result = extractVariables('{{ nome }}');
    expect(result[0].name).toBe('nome');
  });
});

describe('replaceVariables (parser)', () => {
  it('substitui variável simples pelo valor fornecido', () => {
    const result = replaceVariables('Olá {{nome}}!', { nome: 'Maria' });
    expect(result).toBe('Olá Maria!');
  });

  it('substitui múltiplas ocorrências da mesma variável', () => {
    const result = replaceVariables('{{x}} e {{x}}', { x: 'A' });
    expect(result).toBe('A e A');
  });

  it('mantém placeholder quando valor é string vazia', () => {
    const result = replaceVariables('{{nome}}', { nome: '' });
    expect(result).toBe('{{nome}}');
  });

  it('não altera placeholders sem chave correspondente no values', () => {
    const result = replaceVariables('{{nome}} {{cpf}}', { nome: 'João' });
    expect(result).toBe('João {{cpf}}');
  });

  it('retorna a string original quando values é objeto vazio', () => {
    expect(replaceVariables('{{x}}', {})).toBe('{{x}}');
  });

  it('retorna string vazia intacta', () => {
    expect(replaceVariables('', { x: 'y' })).toBe('');
  });
});
