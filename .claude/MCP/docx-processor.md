# MCP: docx-processor

Servidor MCP que expõe o pipeline de processamento de documentos do Opinion Factory —
normalização, renderização HTML e geração de DOCX — como ferramentas chamáveis pelos agentes.

## Responsabilidade

Envelopa as funções de `src/lib/` e `src/app/actions/` permitindo que agentes invoquem
etapas individuais do pipeline para diagnóstico, teste e validação sem acessar o código diretamente.

## Agentes que usam este servidor

- `pipeline-agent` — rastrear transformações etapa por etapa
- `debug-agent` — isolar a etapa com saída incorreta
- `test-agent` — gerar fixtures DOCX para testes de prioridade média
- `orchestrator` — verificar saúde do pipeline antes de delegar

## Tools expostos

### `extract_variables`
Extrai todas as variáveis `{{x}}` de um template.

**Input:**
```json
{ "filename": "Isenção.md" }
```

**Output:**
```json
{
  "variables": [
    { "name": "Parecer", "label": "Parecer", "type": "text" },
    { "name": "DataVistoria", "label": "Data Vistoria", "type": "date" }
  ]
}
```

---

### `render_preview`
Executa o pipeline de pré-visualização e retorna HTML normalizado.

**Input:**
```json
{
  "filename": "Isenção.md",
  "values": { "Parecer": "001/2025", "Interessado": "João Silva" }
}
```

**Output:**
```json
{
  "html": "<p class=\"abnt-centered font-bold\">PARECER Nº 001/2025</p>...",
  "durationMs": 12
}
```

---

### `generate_docx`
Executa o pipeline completo de geração e retorna o DOCX como base64.

**Input:**
```json
{
  "filename": "Isenção.md",
  "values": { "Parecer": "001/2025", "Interessado": "João Silva" }
}
```

**Output:**
```json
{
  "base64": "UEsDB...",
  "sizeBytes": 48320,
  "envelopeApplied": true
}
```

---

### `normalize_markdown`
Aplica `normalizeMarkdown()` e retorna o resultado sem salvar.

**Input:**
```json
{ "content": "PARECER Nº 001\nINTERESSADO: João" }
```

**Output:**
```json
{
  "normalized": "PARECER Nº 001\n\nINTERESSADO: João\n",
  "wasAlreadyNormal": false,
  "changes": [
    { "line": 2, "change": "adicionada linha em branco antes de INTERESSADO" }
  ]
}
```

---

### `normalize_html`
Aplica `normalizeDocumentHtml()` a um HTML e retorna o resultado anotado.

**Input:**
```json
{ "html": "<p><strong>CONCLUSÃO</strong></p><p>Texto</p>" }
```

**Output:**
```json
{
  "normalized": "<h2>CONCLUSÃO</h2><p>Texto</p>",
  "transformations": [
    { "rule": "promoteManualHeadings", "before": "<p><strong>CONCLUSÃO</strong></p>", "after": "<h2>CONCLUSÃO</h2>" }
  ]
}
```

---

### `trace_pipeline`
Executa o pipeline completo para um template `.md` e retorna a saída de cada etapa.

**Input:**
```json
{ "filename": "Isenção.md", "values": {} }
```

**Output:**
```json
{
  "steps": [
    { "step": "normalizeMarkdown",        "outputPreview": "PARECER Nº {{Parecer}}..." },
    { "step": "markdownToTemplateJson",   "outputPreview": "{ blocks: [{ type: 'paragraph'... }] }" },
    { "step": "replaceVariablesInJson",   "outputPreview": "{ blocks: [...] }" },
    { "step": "markdownToDocxBuffer",     "outputPreview": "Buffer(48320 bytes)" },
    { "step": "applyMasterEnvelope",      "outputPreview": "Buffer(61440 bytes)" }
  ]
}
```

## Resources expostos

| URI                                    | Descrição                                      |
|----------------------------------------|------------------------------------------------|
| `pipeline://health`                    | Status do pipeline (deps carregadas, modelo.docx presente) |
| `pipeline://template/{filename}/vars`  | Variáveis extraídas de um template             |
| `pipeline://template/{filename}/html`  | Preview HTML com values vazios                 |

## Implementação

Ver `servers/docx-processor.ts`
