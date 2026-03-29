# MCP: abnt-validator

Servidor MCP que expõe regras de conformidade ABNT como ferramentas de validação,
permitindo que agentes verifiquem templates, HTML e configurações tipográficas programaticamente.

## Responsabilidade

Centraliza toda lógica de validação ABNT — estrutura de blocos Markdown, classes CSS no HTML,
espaçamento e tipografia no DOCX XML — em ferramentas reutilizáveis pelos agentes.

## Agentes que usam este servidor

- `template-agent` — validar template antes de salvar
- `quality-agent` — auditar conformidade de todos os templates
- `rules-agent` — comparar código com especificação ABNT
- `debug-agent` — identificar qual bloco viola o padrão

## Tools expostos

### `validate_markdown_structure`
Verifica se um conteúdo Markdown segue a estrutura ABNT de pareceres fiscais.

**Input:**
```json
{ "content": "PARECER Nº 001\nINTERESSADO: João" }
```

**Output:**
```json
{
  "valid": false,
  "violations": [
    {
      "line": 1,
      "rule": "block-isolation",
      "message": "Linha PARECER deve ter linha em branco depois. Encontrado: linha de metadados logo a seguir.",
      "severity": "error"
    }
  ]
}
```

---

### `validate_variable_names`
Audita nomes de variáveis `{{x}}` de um template quanto às convenções do projeto.

**Input:**
```json
{ "content": "INTERESSADO: {{nome interessado}}\nCPF: {{cpf_pessoa}}" }
```

**Output:**
```json
{
  "valid": false,
  "issues": [
    {
      "variable": "nome interessado",
      "issue": "nome contém espaço — use camelCase: {{nomeInteressado}}",
      "severity": "error"
    },
    {
      "variable": "cpf_pessoa",
      "issue": "nome usa snake_case — use camelCase: {{cpfPessoa}}",
      "severity": "warning"
    }
  ]
}
```

---

### `classify_block`
Classifica semanticamente uma linha de Markdown (PARECER, metadata, date, fecho, body, etc.).

**Input:**
```json
{ "line": "INTERESSADO: João Silva" }
```

**Output:**
```json
{
  "type": "metadata",
  "isolated": true,
  "requiresBlankLineBefore": true,
  "requiresBlankLineAfter": true
}
```

---

### `validate_html_blocks`
Verifica se as classes CSS ABNT estão corretas no HTML gerado.

**Input:**
```json
{ "html": "<p>PARECER Nº 001</p><p>INTERESSADO: João</p>" }
```

**Output:**
```json
{
  "valid": false,
  "violations": [
    {
      "element": "<p>PARECER Nº 001</p>",
      "expected": "class=\"abnt-centered font-bold abnt-parecer\"",
      "found": "nenhuma classe ABNT",
      "rule": "standardizeLegalBlocks"
    }
  ]
}
```

---

### `get_abnt_spec`
Retorna a especificação ABNT completa usada pelo projeto.

**Input:** nenhum

**Output:**
```json
{
  "typography": {
    "font": "Times New Roman",
    "sizePt": 12,
    "lineSpacing": 1.5,
    "lineSpacingTwips": 360
  },
  "margins": {
    "topCm": 3, "leftCm": 3,
    "rightCm": 2, "bottomCm": 2
  },
  "indentation": {
    "firstLineCm": 1.25,
    "firstLineTwips": 709
  },
  "blockTypes": {
    "title":    { "alignment": "center", "bold": true, "indent": false },
    "metadata": { "alignment": "left",   "bold": false, "indent": false },
    "date":     { "alignment": "right",  "bold": false, "indent": false },
    "section":  { "alignment": "left",   "bold": true,  "indent": false },
    "body":     { "alignment": "justified", "bold": false, "indent": true },
    "closing":  { "alignment": "left",   "bold": false, "indent": false }
  }
}
```

---

### `audit_all_templates`
Executa validação ABNT em todos os templates de `Docs/` e retorna relatório consolidado.

**Input:** nenhum

**Output:**
```json
{
  "summary": { "total": 3, "valid": 2, "withErrors": 1, "withWarnings": 0 },
  "results": [
    { "filename": "Isenção.md", "valid": true, "violations": [] },
    { "filename": "Indeferimento.md", "valid": false, "violations": [...] }
  ]
}
```

## Resources expostos

| URI                     | Descrição                                         |
|-------------------------|---------------------------------------------------|
| `abnt://spec`           | Especificação ABNT completa (tipografia, margens) |
| `abnt://block-patterns` | Regex de classificação de cada tipo de bloco      |
| `abnt://css-classes`    | Mapa de tipo de bloco → classe CSS esperada       |

## Implementação

Ver `servers/abnt-validator.ts`
