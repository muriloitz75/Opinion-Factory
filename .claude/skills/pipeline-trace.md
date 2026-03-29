# Skill: pipeline-trace

Rastrear o fluxo completo de processamento de um documento para diagnóstico ou entendimento.

## Como usar

`/pipeline-trace [arquivo ou tipo de problema]`

Exemplos:
- `/pipeline-trace modelo.md`
- `/pipeline-trace saída DOCX corrompida`

## Mapa do pipeline

### Markdown → DOCX

```
Docs/template.md
  │
  ▼ src/lib/markdown-normalizer.ts
  │  normalizeMarkdown()
  │  → impõe estrutura ABNT (blocos, espaçamentos, metadados)
  │
  ▼ src/lib/template-markdown.ts
  │  markdownToTemplateJson()
  │  → converte em array de blocos tipados (title, metadata, section, etc.)
  │
  ▼ src/lib/template-json.ts
  │  replaceVariables(formData)
  │  → substitui {{variavel}} pelos valores do formulário
  │
  ▼ src/lib/template-markdown.ts
  │  markdownToDocxBuffer()
  │  → gera buffer DOCX com estilos ABNT (Times New Roman, margens, etc.)
  │
  ▼ src/app/actions/generate.ts
     applyMasterEnvelope()
     → injeta conteúdo em model/modelo.docx (preserva sectPr)
     → retorna Buffer final para download
```

### DOCX → DOCX

```
Docs/template.docx
  │
  ▼ src/app/actions/generate.ts
  │  docxtemplater.render(formData)
  │  → substitui {variavel} no XML do DOCX
  │
  ▼ src/lib/template-docx.ts
  │  standardizeDocxXml()
  │  → normaliza estrutura XML para compatibilidade
  │
  ▼ src/app/actions/generate.ts
     applyMasterEnvelope()
     → injeta em model/modelo.docx
     → retorna Buffer final
```

### Pré-visualização HTML (ambos os formatos)

```
Markdown/DOCX normalizado
  │
  ▼ src/app/actions/render.ts
  │  (chama html-normalize)
  │
  ▼ src/lib/html-normalize.ts
     normalizeDocumentHtml() — 4 fases:
       1. Extração de blocos semânticos
       2. Classificação (title/metadata/section/body/closing)
       3. Aplicação de classes CSS ABNT
       4. Geração do HTML final
```

## Como adicionar logs temporários

Para rastrear um problema, adicione `console.log` nos pontos-chave:

```ts
// Em qualquer etapa do pipeline (server-side):
console.log('[pipeline-trace] entrada:', JSON.stringify(entrada, null, 2))
```

Os logs aparecem no terminal do `npm run dev`.

## Pontos de falha mais comuns

| Etapa                    | Falha típica                                         |
|--------------------------|------------------------------------------------------|
| `normalizeMarkdown`      | Estrutura do template fora do padrão ABNT            |
| `replaceVariables`       | Nome da variável no template ≠ nome no formulário    |
| `markdownToDocxBuffer`   | Tipo de bloco não reconhecido → parágrafo sem estilo |
| `applyMasterEnvelope`    | `modelo.docx` ausente ou corrompido                  |
| `docxtemplater.render`   | Sintaxe `{var}` errada no DOCX (ex: espaço interno)  |
