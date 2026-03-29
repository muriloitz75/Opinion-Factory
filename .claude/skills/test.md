# Skill: test

Criar e executar testes para o Opinion Factory.

## Como usar

`/test [arquivo ou função alvo]`

Exemplos:
- `/test markdown-normalizer`
- `/test replaceVariables`
- `/test pipeline completo`

## Setup (projeto ainda não tem testes)

Ao criar o primeiro teste, instale Vitest:

```bash
npm install -D vitest @vitest/ui
```

Adicione ao `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
}
```

Crie `vitest.config.ts` na raiz:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

## O que testar neste projeto

### Prioridade alta (lógica pura, fácil de testar)

| Arquivo                              | O que validar                                    |
|--------------------------------------|--------------------------------------------------|
| `src/lib/parser.ts`                  | Extração correta de variáveis `{{x}}`            |
| `src/lib/markdown-normalizer.ts`     | Saída ABNT para cada tipo de bloco               |
| `src/lib/template-json.ts`           | Substituição de variáveis sem efeitos colaterais |

### Prioridade média (requer fixtures de arquivo)

| Arquivo                              | O que validar                                    |
|--------------------------------------|--------------------------------------------------|
| `src/lib/template-markdown.ts`       | Markdown → DOCX (comparar buffers)               |
| `src/lib/html-normalize.ts`          | HTML de entrada → HTML ABNT esperado             |

## Convenção de arquivos

Crie os testes em `src/lib/__tests__/` com o padrão `nome-do-arquivo.test.ts`.

## Exemplo mínimo

```ts
// src/lib/__tests__/parser.test.ts
import { describe, it, expect } from 'vitest'
import { extractVariables } from '@/lib/parser'

describe('extractVariables', () => {
  it('extrai variáveis únicas do template', () => {
    const result = extractVariables('Olá {{nome}}, seu CPF é {{cpf}}.')
    expect(result).toEqual(['nome', 'cpf'])
  })

  it('retorna array vazio se não houver variáveis', () => {
    expect(extractVariables('Texto sem variáveis')).toEqual([])
  })
})
```
