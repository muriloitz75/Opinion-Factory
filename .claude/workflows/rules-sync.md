# Workflow: rules-sync

**Gatilho:** Automático — dispara via hook `Stop` quando Claude encerra uma resposta

## O que faz

Ao final de cada resposta, verifica se arquivos em `src/lib/` ou `src/app/` foram modificados
na sessão atual. Se sim, instrui Claude a lembrar o usuário de rodar `/review-rules`.

```
git status → detecta modificações em src/ → instrui revisão de regras
```

## Comportamento

| Situação | Ação |
|----------|------|
| Nenhum arquivo `src/` modificado | Silencioso (exit 0) |
| `stop_hook_active: true` | Silencioso (evita loop infinito) |
| Arquivos `src/lib/` ou `src/app/` modificados | Claude é instruído a sugerir `/review-rules` |

## Por que isso importa

As regras em `.claude/rules/` documentam o comportamento do código. Quando o código muda,
as regras podem ficar desatualizadas. Este hook garante que o `rules-agent` seja lembrado
de verificar consistência após cada sessão de desenvolvimento.

## Script

`.claude/workflows/scripts/rules-sync.js`

## Agentes envolvidos

- `rules-agent` — executa a revisão quando acionado via `/review-rules`
