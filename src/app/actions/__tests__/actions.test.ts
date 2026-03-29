import { describe, it, expect } from 'vitest'
import { deleteTemplate, getTemplates } from '../templates'
import { generateFilledDocx } from '../generate'
import { renderTemplate } from '../render'

// ── deleteTemplate ────────────────────────────────────────────

describe('deleteTemplate', () => {
  it('retorna success:false para extensão não suportada (.pdf)', async () => {
    const result = await deleteTemplate('arquivo.pdf')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('retorna success:false para extensão não suportada (.txt)', async () => {
    const result = await deleteTemplate('arquivo.txt')
    expect(result.success).toBe(false)
  })

  it('retorna success:false para arquivo inexistente com extensão .md', async () => {
    const result = await deleteTemplate('nao-existe-jamais-xyz.md')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('retorna success:false para arquivo inexistente com extensão .docx', async () => {
    const result = await deleteTemplate('nao-existe-jamais-xyz.docx')
    expect(result.success).toBe(false)
  })
})

// ── getTemplates ──────────────────────────────────────────────

describe('getTemplates', () => {
  it('retorna um array (vazio ou com templates reais)', async () => {
    const result = await getTemplates()
    expect(Array.isArray(result)).toBe(true)
  })

  it('cada template tem as propriedades obrigatórias', async () => {
    const result = await getTemplates()
    for (const t of result) {
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('filename')
      expect(t).toHaveProperty('variables')
      expect(t).toHaveProperty('type')
      expect(['docx', 'markdown']).toContain(t.type)
    }
  })

  it('retorna templates ordenados alfabeticamente por nome', async () => {
    const result = await getTemplates()
    if (result.length >= 2) {
      const names = result.map(t => t.name)
      const sorted = [...names].sort((a, b) => a.localeCompare(b))
      expect(names).toEqual(sorted)
    }
  })

  it('templates .md têm type markdown', async () => {
    const result = await getTemplates()
    const mdTemplates = result.filter(t => t.filename.endsWith('.md'))
    mdTemplates.forEach(t => expect(t.type).toBe('markdown'))
  })

  it('templates .docx têm type docx', async () => {
    const result = await getTemplates()
    const docxTemplates = result.filter(t => t.filename.endsWith('.docx'))
    docxTemplates.forEach(t => expect(t.type).toBe('docx'))
  })
})

// ── generateFilledDocx ────────────────────────────────────────

describe('generateFilledDocx', () => {
  it('retorna erro para arquivo inexistente', async () => {
    const result = await generateFilledDocx('nao-existe-jamais-xyz.md', {})
    expect(result.base64).toBe('')
    expect(result.error).toBeDefined()
  })

  it('retorna base64 não-vazio para template .md real (se existir)', async () => {
    const templates = await getTemplates()
    const md = templates.find(t => t.type === 'markdown')
    if (!md) return // Pula se não houver templates .md no ambiente de teste

    const values = Object.fromEntries(md.variables.map(v => [v, 'Teste']))
    const result = await generateFilledDocx(md.filename, values)
    expect(result.error).toBeUndefined()
    expect(result.base64.length).toBeGreaterThan(0)
  })

  it('retorna base64 não-vazio para template .docx real (se existir)', async () => {
    const templates = await getTemplates()
    const docx = templates.find(t => t.type === 'docx')
    if (!docx) return

    const values = Object.fromEntries(docx.variables.map(v => [v, 'Teste']))
    const result = await generateFilledDocx(docx.filename, values)
    expect(result.error).toBeUndefined()
    expect(result.base64.length).toBeGreaterThan(0)
  })
})

// ── renderTemplate ────────────────────────────────────────────

describe('renderTemplate', () => {
  it('retorna erro para arquivo inexistente', async () => {
    const result = await renderTemplate('nao-existe-jamais-xyz.md', {})
    expect(result.html).toBe('')
    expect(result.error).toBeDefined()
  })

  it('retorna HTML para template .md real (se existir)', async () => {
    const templates = await getTemplates()
    const md = templates.find(t => t.type === 'markdown')
    if (!md) return

    const result = await renderTemplate(md.filename, {})
    expect(result.error).toBeUndefined()
    expect(result.html.length).toBeGreaterThan(0)
    expect(result.html).toContain('<')
  })

  it('retorna HTML para template .docx real (se existir)', async () => {
    const templates = await getTemplates()
    const docx = templates.find(t => t.type === 'docx')
    if (!docx) return

    const result = await renderTemplate(docx.filename, {})
    expect(result.error).toBeUndefined()
    expect(result.html.length).toBeGreaterThan(0)
  })
})
