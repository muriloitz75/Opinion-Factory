# Skill: lint

Verificar qualidade de código com ESLint e TypeScript.

## Como usar

`/lint` — executa verificação completa

## Comandos

```bash
# ESLint
npm run lint

# TypeScript (type check sem emitir arquivos)
npx tsc --noEmit

# Ambos em sequência
npm run lint && npx tsc --noEmit
```

## Interpretando erros comuns

### ESLint

| Erro                                      | Causa comum                                         |
|-------------------------------------------|-----------------------------------------------------|
| `@typescript-eslint/no-explicit-any`      | Use o tipo correto ou `unknown` em vez de `any`     |
| `react-hooks/exhaustive-deps`             | Dependências faltando no `useEffect`/`useCallback`  |
| `@next/next/no-img-element`               | Use `<Image>` do Next.js em vez de `<img>`          |

### TypeScript

| Erro                                      | Causa comum                                         |
|-------------------------------------------|-----------------------------------------------------|
| `Cannot find module '@/...'`              | Caminho errado — aliases configurados em `tsconfig.json` |
| `Type 'X' is not assignable to type 'Y'` | Verificar o retorno de Server Actions (podem ser `Promise`) |
| `Property 'X' does not exist`             | Tipo de objeto incorreto — verificar interfaces     |

## Configuração atual

- **ESLint**: `eslint.config.mjs` — Next.js core-web-vitals + TypeScript
- **TypeScript**: modo strict ativado, `moduleResolution: bundler`
- Alias `@/*` → `./src/*`

## Quando rodar

- Antes de qualquer commit
- Após refatorar `src/lib/` (funções puras têm tipagem estrita)
- Após alterar Server Actions (verificar tipos de retorno e parâmetros)
