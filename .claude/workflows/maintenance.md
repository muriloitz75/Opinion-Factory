# Workflow: maintenance

**Gatilho:** Manual — `/maintenance` ou solicitação ao orchestrator

## O que faz

Revisão periódica completa do projeto em 4 etapas sequenciais:

```
1. audit-templates   → abnt-validator MCP: valida todos os templates em Docs/
2. review-rules      → rules-agent: compara .claude/rules/ com o código atual
3. quality-gate      → quality-agent: lint + tsc + testes
4. relatório         → orchestrator: consolida e apresenta ao usuário
```

## Quando usar

- Após sprints de desenvolvimento intenso
- Antes de apresentar o projeto para novos colaboradores
- Quando templates foram adicionados ou modificados em lote
- Mensalmente como rotina de saúde do projeto

## Sequência de delegação (orchestrator)

```
orchestrator
  ├─→ template-agent     (audit_all_templates via abnt-validator MCP)
  ├─→ rules-agent        (review-rules via /review-rules skill)
  ├─→ quality-agent      (lint + tsc + test via test-runner MCP)
  └─→ [relatório consolidado]
```

## Saída esperada

```
## Relatório de Manutenção — DD/MM/AAAA

### Templates (3 total)
- ✓ Isenção.md — válido
- ✓ Indeferimento NES.md — válido
- ⚠ Indeferimento NFS-e.md — 1 warning: variável {{NFS-e}} com hífen

### Regras (.claude/rules/)
- ✓ architecture.md — coerente com o código
- ⚠ abnt.md — mention de standardizeDocxXml desatualizado (linha 12)

### Qualidade
- ✓ ESLint: 0 errors, 5 warnings
- ✓ TypeScript: 0 errors
- ✓ Testes: 124/124 passando

### Ações recomendadas
1. Corrigir nome da variável em Indeferimento NFS-e.md
2. Atualizar abnt.md linha 12
```
