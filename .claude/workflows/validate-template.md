# Workflow: validate-template

**Gatilho:** Automático — dispara via hook `PostToolUse` em escrita/edição de arquivos `Docs/*.md`

## O que faz

Após salvar qualquer template Markdown em `Docs/`, valida automaticamente:

```
estrutura de blocos ABNT → nomes de variáveis → isolamento com linhas em branco
```

## Comportamento

| Resultado | Ação |
|-----------|------|
| Template válido | Confirmação no contexto do Claude |
| Violações encontradas | Lista de problemas enviada ao Claude para correção |

O hook não desfaz a escrita — é informativo. Claude decide se deve corrigir.

## Script

`.claude/workflows/scripts/validate-template.js`

## Regras verificadas

- Linha `PARECER` isolada com linha em branco antes e depois
- Metadados (`INTERESSADO`, `PROCESSO`, etc.) isolados
- Linha de data isolada
- Fecho isolado
- Variáveis `{{x}}` em camelCase, sem espaços ou acentos

## Agentes envolvidos

- `template-agent` — corrige violações de estrutura ABNT
- `abnt-validator` MCP — fonte das regras de validação
