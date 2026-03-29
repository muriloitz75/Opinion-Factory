# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar com o código deste repositório.

## Comandos

```bash
npm run dev      # Servidor de desenvolvimento (Next.js)
npm run build    # Build de produção
npm run start    # Servidor de produção (requer build prévio)
npm run lint     # Verificação ESLint
```

## Visão Geral

**Opinion Factory** é uma ferramenta Next.js de geração de documentos (Gerador de Pareceres Fiscais) que cria pareceres fiscais formatados conforme a ABNT a partir de templates com substituição dinâmica de variáveis.

### Stack
- **Next.js 16 + React 19** — App Router com Server Actions (sem rotas de API)
- **docx** — Geração programática de DOCX a partir de templates Markdown
- **docxtemplater + pizzip** — Substituição de variáveis em templates DOCX
- **mammoth** — Conversão DOCX → HTML para pré-visualização
- **html2pdf.js / jspdf** — Exportação para PDF

### Estrutura de Diretórios
- `src/app/page.tsx` — UI de página única (todo o estado reside aqui)
- `src/app/actions/` — Server Actions: `generate.ts`, `render.ts`, `templates.ts`, `upload.ts`
- `src/lib/` — Pipeline central de processamento
- `Docs/` — Arquivos de template (`.md` e `.docx`)
- `model/modelo.docx` — Template mestre (cabeçalhos/rodapés institucionais aplicados a toda saída)

## Regras Específicas

Regras detalhadas por domínio estão em `.claude/rules/`:

- [`architecture.md`](.claude/rules/architecture.md) — Server Actions, pipelines de processamento, envelope mestre, sistema de variáveis
- [`abnt.md`](.claude/rules/abnt.md) — Tipografia, layout, estrutura de blocos, normalização de Markdown
- [`ui.md`](.claude/rules/ui.md) — Idioma (pt-BR), debounce, tipos de input, upload/importação
