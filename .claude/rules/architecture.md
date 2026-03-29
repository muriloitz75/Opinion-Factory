# Regras de Arquitetura

## Padrões Next.js

- Usar **Server Actions** para toda lógica de servidor — não criar rotas de API (`/api/`)
- Server Actions ficam em `src/app/actions/`
- Todo estado da UI reside em `src/app/page.tsx`

## Pipelines de Processamento

Não alterar a ordem das etapas dos pipelines sem necessidade explícita:

**Markdown → DOCX:**
```
.md → normalizeMarkdown() → markdownToTemplateJson() → replaceVariables()
    → blockToParagraphs()  ← detecção de blocos (parecer/meta/data/fecho) por posição e conteúdo
    → markdownToDocxBuffer() → applyMasterEnvelope()
```

**DOCX → DOCX:**
```
.docx → docxtemplater.render() → standardizeDocxXml() → applyFechoByPositionDocx() → applyMasterEnvelope()
```

**Pré-visualização HTML:**
```
.md   → markdownToTemplateJson() → markdownToHtml() → normalizeDocumentHtml() → substituição de variáveis (span.var-filled)
.docx → mammoth (→ marcadores PUA) → normalizeDocumentHtml() → PUA → span.var-filled
```

## Envelope Mestre

- Toda saída final passa por `applyMasterEnvelope()` com `model/modelo.docx`
- O `sectPr` (propriedades de seção) do template mestre **sempre** é preservado
- Nunca gerar DOCX final sem passar pelo envelope mestre

## Sistema de Variáveis

- Sintaxe obrigatória nos templates: `{{nomeVariavel}}`
- Variáveis persistem por template no estado do cliente via `formDataByTemplate`

## Geração de PDF

- Técnica aprovada: geração via iframe (não via renderização direta no DOM)
- Ver `project_pdf_layout_standards.md` na memória do projeto para padrões visuais
