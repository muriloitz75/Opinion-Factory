# Skill: review-rules

Revisar as regras do projeto em `.claude/rules/` e verificar se estão coerentes com o estado atual do código.

## Como usar

`/review-rules` — executa a revisão completa de todas as regras

## Protocolo de revisão

### 1. Ler os arquivos de regras

Leia cada arquivo em `.claude/rules/`:

- `.claude/rules/architecture.md` — pipelines, Server Actions, envelope mestre
- `.claude/rules/abnt.md` — tipografia, normalização de Markdown
- `.claude/rules/ui.md` — idioma, debounce, tipos de input

### 2. Verificar coerência com o código atual

Para cada regra, confirme se ainda reflete o que está implementado:

| Regra                              | Onde verificar no código                          |
|------------------------------------|---------------------------------------------------|
| Pipelines Markdown e DOCX          | `src/app/actions/generate.ts`                     |
| `applyMasterEnvelope`              | `src/app/actions/generate.ts`                     |
| `normalizeMarkdown`                | `src/lib/markdown-normalizer.ts`                  |
| `normalizeDocumentHtml` (4 fases)  | `src/lib/html-normalize.ts`                       |
| Espaçamentos visuais (headings, blocos) | `src/app/globals.css`                        |
| Debounce de 700ms                  | `src/app/page.tsx`                                |
| Tipos de input por nome            | `src/app/page.tsx`                                |
| Server Actions (sem rotas de API)  | `src/app/actions/` (não deve existir `src/app/api/`) |
| Sintaxe `{{variavel}}`             | `src/lib/parser.ts`                               |

### 3. Verificar coerência entre os arquivos de regras

- Nenhuma regra em um arquivo contradiz outra em arquivo diferente
- Não há duplicação de conteúdo entre `architecture.md`, `abnt.md` e `ui.md`
- O `CLAUDE.md` referencia corretamente os três arquivos

### 4. Reportar o resultado

Para cada arquivo de regra, informe:

```
## architecture.md
- [OK] applyMasterEnvelope preserva sectPr — confirmado em generate.ts:L42
- [DESATUALIZADO] pipeline menciona standardizeDocxXml — função renomeada para normalizeXml em template-docx.ts
- [AUSENTE] função extractSectPr adicionada recentemente não está documentada
```

### 5. Atualizar regras desatualizadas

Após o relatório, pergunte ao usuário quais itens deseja atualizar. Para cada aprovado:
- Edite o arquivo de regra correspondente
- Mantenha o mesmo estilo e nível de detalhe já existente
- Não adicione seções novas sem necessidade — prefira atualizar o texto existente

## O que NÃO faz esta skill

- Não altera código-fonte — apenas os arquivos em `.claude/rules/`
- Não cria novas regras além das já existentes (use `/new-rule` para isso)
- Não revisa `CLAUDE.md` em profundidade — apenas verifica se os links para `.claude/rules/` estão corretos
