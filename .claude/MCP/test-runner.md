# MCP: test-runner

Servidor MCP que envolve o Vitest e expõe execução de testes, resultados e cobertura
como ferramentas e recursos consultáveis pelos agentes.

## Responsabilidade

Permite que agentes executem testes, consultem resultados anteriores e identifiquem
falhas sem precisar interpretar saída de terminal bruta.

## Agentes que usam este servidor

- `test-agent` — criar testes e confirmar que passam
- `debug-agent` — reproduzir falha via teste antes de corrigir
- `orchestrator` — verificar health geral antes de um merge/deploy

## Tools expostos

### `run_all_tests`
Executa `npm test` e retorna resultado estruturado.

**Input:** nenhum

**Output:**
```json
{
  "passed": 124,
  "failed": 0,
  "skipped": 0,
  "durationMs": 848,
  "files": [
    { "file": "src/lib/__tests__/parser.test.ts", "passed": 14, "failed": 0 },
    { "file": "src/lib/__tests__/template-json.test.ts", "passed": 36, "failed": 0 }
  ]
}
```

---

### `run_test_file`
Executa um único arquivo de teste.

**Input:**
```json
{ "filepath": "src/lib/__tests__/parser.test.ts" }
```

**Output:**
```json
{
  "passed": 14,
  "failed": 0,
  "durationMs": 120,
  "tests": [
    { "name": "extrai variável simples", "status": "passed", "durationMs": 2 }
  ]
}
```

---

### `run_test_pattern`
Executa testes cujo nome corresponde ao padrão fornecido.

**Input:**
```json
{ "pattern": "normalizeMarkdown" }
```

**Output:**
```json
{
  "matched": 4,
  "passed": 4,
  "failed": 0,
  "tests": [...]
}
```

---

### `get_last_results`
Retorna o resultado da última execução de testes (sem rodar novamente).

**Input:** nenhum

**Output:** mesmo formato de `run_all_tests`, com campo `"cachedAt"` adicional.

---

### `list_test_files`
Lista todos os arquivos de teste do projeto.

**Input:** nenhum

**Output:**
```json
{
  "files": [
    { "path": "src/lib/__tests__/parser.test.ts", "functions": ["extractVariables", "replaceVariables"] },
    { "path": "src/lib/__tests__/template-json.test.ts", "functions": ["blockTextToHtml", "markdownToTemplateJson", "extractVariablesFromTemplateJson", "replaceVariablesInTemplateJson"] }
  ],
  "uncoveredFunctions": ["markdownToDocxBuffer", "docxToHtml"]
}
```

---

### `run_lint`
Executa `npm run lint` e retorna erros/warnings estruturados.

**Input:** nenhum

**Output:**
```json
{
  "errors": 0,
  "warnings": 5,
  "issues": [
    {
      "file": "src/lib/html-normalize.ts",
      "line": 135,
      "rule": "no-unused-vars",
      "message": "cleanRedundantSpans is defined but never used",
      "severity": "warning"
    }
  ]
}
```

---

### `run_typecheck`
Executa `npx tsc --noEmit` e retorna erros de tipo estruturados.

**Input:** nenhum

**Output:**
```json
{
  "errors": 0,
  "diagnostics": []
}
```

## Resources expostos

| URI                         | Descrição                                             |
|-----------------------------|-------------------------------------------------------|
| `tests://results/last`      | Resultado da última execução (JSON estruturado)       |
| `tests://files`             | Lista de arquivos de teste com funções cobertas       |
| `tests://lint/last`         | Resultado do último lint                              |
| `tests://coverage/summary`  | Resumo de cobertura por arquivo (quando disponível)   |

## Implementação

Ver `servers/test-runner.ts`
