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

```
src/
├── app/
│   ├── page.tsx              # UI de página única (todo o estado reside aqui)
│   ├── globals.css           # Estilos globais e classes ABNT
│   └── actions/
│       ├── generate.ts       # Geração DOCX: standardizeDocxXml, applyFechoByPositionDocx, applyMasterEnvelope
│       ├── render.ts         # Pré-visualização HTML: docxToHtml (mammoth + normalização)
│       ├── templates.ts      # Listagem de templates em Docs/
│       └── upload.ts         # Upload e importação do Google Docs
└── lib/
    ├── markdown-normalizer.ts  # Normalização estrutural do Markdown (fonte de verdade ABNT)
    ├── template-json.ts        # Parser Markdown → TemplateJsonDocument + substituição de variáveis
    ├── template-markdown.ts    # TemplateJson → DOCX (pipeline .md) + markdownToHtml
    ├── template-docx.ts        # Utilitários para templates .docx
    ├── html-normalize.ts       # normalizeDocumentHtml: 4 fases de normalização ABNT do HTML
    └── parser.ts               # Utilitários de parsing auxiliares

Docs/                           # Arquivos de template (.md e .docx)
model/modelo.docx               # Template mestre (cabeçalho/rodapé institucional)
```

## Regras Específicas

Regras detalhadas por domínio estão em `.claude/rules/`:

- [`architecture.md`](.claude/rules/architecture.md) — Server Actions, pipelines de processamento, envelope mestre, sistema de variáveis
- [`abnt.md`](.claude/rules/abnt.md) — Tipografia, layout, estrutura de blocos, normalização de Markdown e HTML
- [`ui.md`](.claude/rules/ui.md) — Idioma (pt-BR), debounce, tipos de input, upload/importação
