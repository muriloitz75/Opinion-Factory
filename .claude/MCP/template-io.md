# MCP: template-io

Servidor MCP para gerenciamento de templates da pasta `Docs/` e importação via Google Docs.

## Responsabilidade

Abstrai todo o acesso ao sistema de arquivos de templates, expondo operações de leitura,
escrita, listagem e importação para os agentes sem que precisem manipular `fs` diretamente.

## Agentes que usam este servidor

- `template-agent` — criar, editar e validar templates
- `rules-agent` — ler templates para comparar com regras
- `debug-agent` — inspecionar conteúdo de templates com problema
- `orchestrator` — listar templates para decidir delegação

## Tools expostos

### `list_templates`
Lista todos os templates disponíveis com metadados.

**Input:** nenhum

**Output:**
```json
[
  {
    "name": "Isenção",
    "filename": "Isenção.md",
    "type": "markdown",
    "variables": ["Parecer", "Processo", "Interessado", "CPF"],
    "sizeBytes": 5400
  }
]
```

---

### `read_template`
Lê o conteúdo bruto de um template.

**Input:**
```json
{ "filename": "Isenção.md" }
```

**Output:**
```json
{ "content": "PARECER Nº {{Parecer}}/...", "type": "markdown" }
```

---

### `create_template`
Cria um novo template Markdown em `Docs/`. Aplica normalização ABNT automaticamente.

**Input:**
```json
{
  "filename": "novo-parecer.md",
  "content": "PARECER Nº {{Parecer}}/{{ano}}\n\nINTERESSADO: {{nome}}\n..."
}
```

**Output:**
```json
{ "success": true, "normalizedContent": "..." }
```

---

### `delete_template`
Remove um template de `Docs/`.

**Input:**
```json
{ "filename": "Isenção.md" }
```

**Output:**
```json
{ "success": true }
```

---

### `import_from_google_docs`
Importa documento público do Google Docs como template DOCX.

**Input:**
```json
{ "url": "https://docs.google.com/document/d/DOCUMENT_ID/edit" }
```

**Output:**
```json
{ "success": true, "filename": "gdoc-DOCUMENT_ID.docx" }
```

---

### `normalize_template`
Aplica normalização ABNT estrita a um template Markdown e salva.

**Input:**
```json
{ "filename": "parecer.md" }
```

**Output:**
```json
{
  "alreadyNormalized": false,
  "normalizedContent": "...",
  "changesMade": ["linha 3: adicionada linha em branco após PARECER"]
}
```

---

### `read_master_model`
Retorna metadados do arquivo mestre `model/modelo.docx`.

**Input:** nenhum

**Output:**
```json
{
  "exists": true,
  "sizeBytes": 28672,
  "path": "model/modelo.docx"
}
```

## Resources expostos

| URI                              | Descrição                                 |
|----------------------------------|-------------------------------------------|
| `docs://templates`               | Lista completa de templates (JSON)        |
| `docs://template/{filename}`     | Conteúdo bruto de um template específico  |
| `docs://model`                   | Info do template mestre modelo.docx       |

## Implementação

Ver `servers/template-io.ts`

## Restrições de segurança

- Só aceita extensões `.md` e `.docx`
- Operações de escrita limitadas à pasta `Docs/`
- `modelo.docx` é somente leitura via este servidor
