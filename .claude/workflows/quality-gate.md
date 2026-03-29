# Workflow: quality-gate

**Gatilho:** Automático — dispara via hook `PreToolUse` em todo `git commit`

## O que faz

Bloqueia o commit se qualquer verificação falhar:

```
lint (ESLint) → typecheck (tsc --noEmit) → tests (vitest run)
```

## Comportamento

| Resultado | Ação |
|-----------|------|
| Tudo passou | Commit liberado |
| Qualquer falha | Commit bloqueado + motivo exibido para Claude |

## Script

`.claude/workflows/scripts/quality-gate.js`

## Acionamento manual

```bash
npm run lint && npx tsc --noEmit && npm test
```

Ou via skill: `/lint` para verificação isolada.

## Agentes envolvidos

- `quality-agent` — interpreta os erros e propõe correções
- `test-agent` — corrige testes quebrados
