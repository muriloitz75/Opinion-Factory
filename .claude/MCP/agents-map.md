# MCP — Mapeamento Agentes × Servidores

Cada servidor MCP expõe **tools** (funções chamáveis) e **resources** (dados consultáveis)
que os agentes usam para acessar dados e ferramentas externas de forma padronizada.

## Matriz de dependências

| Agente           | template-io | docx-processor | abnt-validator | test-runner |
|------------------|:-----------:|:--------------:|:--------------:|:-----------:|
| `orchestrator`   | ✓           | ✓              |                | ✓           |
| `debug-agent`    | ✓           | ✓              | ✓              | ✓           |
| `pipeline-agent` | ✓           | ✓              |                |             |
| `test-agent`     |             | ✓              |                | ✓           |
| `quality-agent`  |             |                | ✓              | ✓           |
| `template-agent` | ✓           |                | ✓              |             |
| `rules-agent`    | ✓           |                | ✓              |             |

## Servidores disponíveis

| Servidor           | Arquivo                          | Porta/Transporte | Status      |
|--------------------|----------------------------------|------------------|-------------|
| `template-io`      | `servers/template-io.ts`         | stdio            | stub pronto |
| `docx-processor`   | `servers/docx-processor.ts`      | stdio            | stub pronto |
| `abnt-validator`   | `servers/abnt-validator.ts`      | stdio            | stub pronto |
| `test-runner`      | `servers/test-runner.ts`         | stdio            | stub pronto |

## Como configurar no Claude Code

Adicione ao `.claude/settings.json` do projeto os servidores que deseja ativar:

```json
{
  "mcpServers": {
    "template-io": {
      "command": "npx",
      "args": ["tsx", ".claude/MCP/servers/template-io.ts"]
    },
    "docx-processor": {
      "command": "npx",
      "args": ["tsx", ".claude/MCP/servers/docx-processor.ts"]
    },
    "abnt-validator": {
      "command": "npx",
      "args": ["tsx", ".claude/MCP/servers/abnt-validator.ts"]
    },
    "test-runner": {
      "command": "npx",
      "args": ["tsx", ".claude/MCP/servers/test-runner.ts"]
    }
  }
}
```

## Pré-requisitos para ativar

```bash
npm install -D @modelcontextprotocol/sdk tsx
```

## Fluxo de dados

```
Agente especialista
    │
    ▼  (tool call / resource read via MCP protocol)
Servidor MCP (stdio transport)
    │
    ├─→ template-io      → fs: Docs/, model/modelo.docx
    ├─→ docx-processor   → src/lib/* (pipeline de processamento)
    ├─→ abnt-validator   → regras .claude/rules/abnt.md
    └─→ test-runner      → npm test / vitest
```
