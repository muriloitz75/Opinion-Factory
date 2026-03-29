import { describe, it, expect } from 'vitest'
import PizZip from 'pizzip'
import { markdownToDocxBuffer } from '../template-markdown'

describe('markdownToDocxBuffer', () => {
  it('retorna um Buffer (Uint8Array)', async () => {
    const buffer = await markdownToDocxBuffer('Texto simples.\n', {})
    expect(buffer).toBeInstanceOf(Uint8Array)
  })

  it('buffer não está vazio', async () => {
    const buffer = await markdownToDocxBuffer('Texto simples.\n', {})
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('buffer começa com magic bytes de ZIP/DOCX (PK)', async () => {
    const buffer = await markdownToDocxBuffer('Texto simples.\n', {})
    // DOCX é um ZIP — magic bytes: 0x50 0x4B ('PK')
    expect(buffer[0]).toBe(0x50)
    expect(buffer[1]).toBe(0x4B)
  })

  it('buffer é um ZIP válido parseável por PizZip', async () => {
    const buffer = await markdownToDocxBuffer('Texto simples.\n', {})
    expect(() => new PizZip(buffer)).not.toThrow()
  })

  it('ZIP resultante contém word/document.xml', async () => {
    const buffer = await markdownToDocxBuffer('Texto simples.\n', {})
    const zip = new PizZip(buffer)
    expect(zip.file('word/document.xml')).not.toBeNull()
  })

  it('funciona com markdown vazio', async () => {
    const buffer = await markdownToDocxBuffer('', {})
    expect(buffer).toBeInstanceOf(Uint8Array)
    expect(() => new PizZip(buffer)).not.toThrow()
  })

  it('substitui variáveis preenchidas no conteúdo', async () => {
    const buffer = await markdownToDocxBuffer('INTERESSADO: {{nome}}\n', { nome: 'Maria' })
    const zip = new PizZip(buffer)
    const xml = zip.file('word/document.xml')?.asText() ?? ''
    expect(xml).toContain('Maria')
  })

  it('mantém placeholder quando valor está vazio', async () => {
    const buffer = await markdownToDocxBuffer('INTERESSADO: {{nome}}\n', { nome: '' })
    const zip = new PizZip(buffer)
    const xml = zip.file('word/document.xml')?.asText() ?? ''
    expect(xml).toContain('{{nome}}')
  })

  it('processa heading corretamente (texto presente no XML)', async () => {
    const buffer = await markdownToDocxBuffer('# I — RELATÓRIO\n', {})
    const zip = new PizZip(buffer)
    const xml = zip.file('word/document.xml')?.asText() ?? ''
    expect(xml).toContain('I — RELATÓRIO')
  })

  it('processa lista não-ordenada (itens presentes no XML)', async () => {
    const buffer = await markdownToDocxBuffer('- item um\n- item dois\n', {})
    const zip = new PizZip(buffer)
    const xml = zip.file('word/document.xml')?.asText() ?? ''
    expect(xml).toContain('item um')
    expect(xml).toContain('item dois')
  })
})
