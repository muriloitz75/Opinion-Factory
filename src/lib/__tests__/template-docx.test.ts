import { describe, it, expect } from 'vitest'
import PizZip from 'pizzip'
import { extractVariablesFromDocx, docxToHtml } from '../template-docx'
import { markdownToDocxBuffer } from '../template-markdown'

// Cria um DOCX mínimo válido com o XML de corpo fornecido
function createMinimalDocx(bodyContent: string): Buffer {
  const zip = new PizZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`
  )
  zip.folder('_rels')!.file(
    '.rels',
    `<?xml version="1.0"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`
  )
  zip.folder('word')!.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${bodyContent}</w:body>` +
    `</w:document>`
  )
  zip.folder('word')!.folder('_rels')!.file(
    'document.xml.rels',
    `<?xml version="1.0"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  )
  return zip.generate({ type: 'nodebuffer' }) as Buffer
}

const PARA = (text: string) =>
  `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`

describe('extractVariablesFromDocx', () => {
  it('extrai variável simples do XML do documento', () => {
    const buffer = createMinimalDocx(PARA('Olá {{nome}}'))
    expect(extractVariablesFromDocx(buffer)).toContain('nome')
  })

  it('extrai múltiplas variáveis', () => {
    const buffer = createMinimalDocx(PARA('{{nome}} CPF {{cpf}}'))
    const vars = extractVariablesFromDocx(buffer)
    expect(vars).toContain('nome')
    expect(vars).toContain('cpf')
  })

  it('deduplica variáveis repetidas', () => {
    const buffer = createMinimalDocx(PARA('{{nome}}') + PARA('{{nome}}'))
    const vars = extractVariablesFromDocx(buffer)
    expect(vars.filter(v => v === 'nome')).toHaveLength(1)
  })

  it('retorna array vazio quando não há variáveis', () => {
    const buffer = createMinimalDocx(PARA('Texto sem variáveis'))
    expect(extractVariablesFromDocx(buffer)).toEqual([])
  })

  it('extrai variável mesmo quando Word quebra o texto em múltiplos runs (tags XML entre caracteres)', () => {
    // Simula Word quebrando {{no</w:t><w:t>me}} em runs separados
    const xml = `<w:p><w:r><w:t>{{</w:t></w:r><w:r><w:t>nome</w:t></w:r><w:r><w:t>}}</w:t></w:r></w:p>`
    const buffer = createMinimalDocx(xml)
    // extractVariablesFromDocx remove todas as tags antes de buscar
    expect(extractVariablesFromDocx(buffer)).toContain('nome')
  })

  it('lança exceção para buffer inválido', () => {
    const invalid = Buffer.from('não é um zip')
    expect(() => extractVariablesFromDocx(invalid)).toThrow()
  })
})

describe('docxToHtml', () => {
  it('retorna string HTML para DOCX gerado pelo pipeline markdown', async () => {
    const docxBuffer = await markdownToDocxBuffer(
      'INTERESSADO: {{nome}}\n\nTexto do parecer.\n',
      { nome: 'Maria' }
    )
    const html = await docxToHtml(docxBuffer, { nome: 'Maria' })
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
  })

  it('retorna string HTML mesmo com values vazio', async () => {
    const docxBuffer = await markdownToDocxBuffer('Texto simples.\n', {})
    const html = await docxToHtml(docxBuffer, {})
    expect(typeof html).toBe('string')
  })

  it('envolve valor preenchido em span.var-filled', async () => {
    const docxBuffer = await markdownToDocxBuffer('{{nome}}\n', {})
    const html = await docxToHtml(docxBuffer, { nome: 'João' })
    expect(html).toContain('var-filled')
    expect(html).toContain('João')
  })

  it('lança exceção para buffer inválido', async () => {
    const invalid = Buffer.from('não é um docx')
    await expect(docxToHtml(invalid, {})).rejects.toThrow()
  })
})
