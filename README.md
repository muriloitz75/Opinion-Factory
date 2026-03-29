# Opinion Factory

Gerador de pareceres fiscais com conformidade ABNT automática. Permite carregar modelos (`.md` ou `.docx`), preencher variáveis por formulário e exportar o documento final em `.docx` pronto para uso oficial.

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos e Instalação](#pré-requisitos-e-instalação)
3. [Estrutura do Projeto](#estrutura-do-projeto)
4. [Como Usar](#como-usar)
5. [Sistema de Templates](#sistema-de-templates)
6. [Sistema de Variáveis](#sistema-de-variáveis)
7. [Normalização Estrita de Markdown](#normalização-estrita-de-markdown)
8. [Pipeline de Geração de Documentos](#pipeline-de-geração-de-documentos)
9. [Conformidade ABNT](#conformidade-abnt)
10. [Arquitetura de Código](#arquitetura-de-código)
11. [Referência das Server Actions](#referência-das-server-actions)
12. [Referência das Bibliotecas](#referência-das-bibliotecas)

---

## Visão Geral

O Opinion Factory é uma aplicação Next.js voltada para a emissão padronizada de pareceres fiscais. O sistema lida com dois formatos de template — Markdown (`.md`) e Word (`.docx`) — e produz documentos finais em `.docx` com:

- Margens ABNT (3cm esquerda/topo, 2cm direita/baixo)
- Fonte Times New Roman 12pt com espaçamento 1,5
- Recuo de 1,25cm na primeira linha dos parágrafos de corpo
- Alinhamentos automáticos por tipo de bloco (PARECER centralizado, metadados à esquerda, data à direita)
- Cabeçalho e rodapé institucionais oriundos do arquivo `model/modelo.docx`
- Preview fiel no navegador antes da exportação

---

## Pré-requisitos e Instalação

**Requisitos:**
- Node.js 18+
- npm (ou yarn/pnpm/bun)

**Instalação:**

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd Opinion-Factory

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000` no navegador.

**Scripts disponíveis:**

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot-reload |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção (requer build prévio) |
| `npm run lint` | Verificação de lint |

---

## Estrutura do Projeto

```
Opinion-Factory/
├── model/
│   └── modelo.docx          # Template mestre (cabeçalho, rodapé, margens)
├── Docs/                    # Templates de pareceres
│   ├── Isenção.md
│   ├── Não Execução dos Serviços (NES).md
│   ├── Indeferimento - NFS-e sem declaração.md
│   └── Indeferimento - Não Execução dos Serviços (NES).md
├── src/
│   ├── app/
│   │   ├── actions/         # Server Actions (Next.js)
│   │   │   ├── generate.ts  # Geração do DOCX final
│   │   │   ├── render.ts    # Renderização do preview HTML
│   │   │   ├── templates.ts # Listagem e exclusão de templates
│   │   │   └── upload.ts    # Upload e importação de modelos
│   │   ├── page.tsx         # Interface principal (React)
│   │   ├── globals.css      # Design system completo
│   │   └── layout.tsx       # Layout raiz com fontes
│   └── lib/
│       ├── markdown-normalizer.ts  # Normalizador estrito de markdown
│       ├── template-json.ts        # Parser de markdown para blocos
│       ├── template-markdown.ts    # Conversão markdown → HTML / DOCX
│       ├── template-docx.ts        # Extração e conversão de arquivos DOCX
│       ├── html-normalize.ts       # Normalização ABNT do HTML de preview
│       └── parser.ts               # Extração simplificada de variáveis
└── scripts/
    └── migrate-md-to-json.mjs      # Script utilitário de migração
```

---

## Como Usar

### 1. Selecionar um modelo

Na barra lateral esquerda, o seletor lista todos os modelos disponíveis na pasta `Docs/`. Ao selecionar, o preview é atualizado automaticamente e o formulário de variáveis é exibido. Passe o mouse sobre o seletor para ver o nome completo do modelo (incluindo extensão).

### 2. Preencher as variáveis

Cada campo `{{variavel}}` encontrado no template gera um input no formulário com comportamento automático conforme o tipo:

| Nome contém | Tipo de campo | Comportamento |
|---|---|---|
| `data` | `<input type="date">` | Seletor de data; valor convertido para DD/MM/AAAA no documento |
| `cpf` | texto com máscara | Formata automaticamente como `000.000.000-00` |
| `cnpj` | texto com máscara | Formata automaticamente como `00.000.000/0000-00` |
| outros | texto livre | Sem restrição de formato |

### 3. Exportar o documento

Clique em **Gerar Parecer Fiscal**. O sistema produz um `.docx` pronto com:
- Variáveis substituídas
- Formatação ABNT aplicada automaticamente
- Cabeçalho/rodapé do modelo mestre injetados

### 4. Carregar novos modelos

Clique em **Carregar Modelo** (cabeçalho). São aceitos:
- **Arquivo `.md`** — formato recomendado; normalizado automaticamente ao salvar
- **Arquivo `.docx`** — Word com variáveis `{{variavel}}`
- **Google Docs** — cole o link de um documento público; ele é importado como `.docx`

---

## Sistema de Templates

Os templates ficam na pasta `Docs/`. Novos arquivos aparecem automaticamente na interface sem necessidade de reiniciar o servidor.

### Templates Markdown (recomendado)

Formato nativo da aplicação. Consulte o [Guia de Padronização](Docs/GUIA_DE_PADRONIZACAO.md) para as regras detalhadas de autoria.

**Estrutura mínima de um parecer:**

```markdown
**PARECER DIAAF Nº {{Parecer}}**

PROCESSO Nº: **{{Processo}}**

INTERESSADO: **{{Interessado}}**   CPF: **{{CPF}}**

ASSUNTO: **DESCRIÇÃO DO ASSUNTO**

1. **DA BASE LEGAL**

Texto do primeiro capítulo...

2. **DA ANÁLISE**

Texto do segundo capítulo...

É o parecer. Submeto à douta consideração superior.

Imperatriz, {{Data}}
```

### Templates DOCX

Arquivos Word com campos `{{variavel}}`. O sistema usa o `docxtemplater` para substituição e aplica a padronização ABNT via manipulação de XML após o render.

### Template Mestre (`model/modelo.docx`)

Contém o cabeçalho e rodapé institucionais. Todo documento gerado recebe o corpo do template preenchido injetado dentro do `modelo.docx`, preservando as identidades visuais do documento oficial.

---

## Sistema de Variáveis

Variáveis são declaradas no template com a sintaxe `{{nomeDaVariavel}}`.

**Comportamento geral:**
- Ao carregar um template, a aplicação extrai todas as variáveis automaticamente
- Cada variável gera um campo no formulário lateral
- No preview, variáveis preenchidas aparecem destacadas em azul
- Variáveis não preenchidas são mantidas como `{{nomeDaVariavel}}` no DOCX final

**Tipos automáticos por nome de variável:**

- **`data` no nome** → `<input type="date">`. O valor selecionado (formato interno `AAAA-MM-DD`) é convertido para `DD/MM/AAAA` antes de ser inserido no preview e no DOCX.
- **`cpf` no nome** → máscara `000.000.000-00` aplicada progressivamente ao digitar (aceita apenas dígitos, limite de 11).
- **`cnpj` no nome** → máscara `00.000.000/0000-00` aplicada progressivamente ao digitar (aceita apenas dígitos, limite de 14).

**Exemplos de variáveis usadas nos templates existentes:**

| Variável | Tipo inferido | Descrição |
|---|---|---|
| `{{Parecer}}` | texto | Número do parecer (ex: `001/2025`) |
| `{{Processo}}` | texto | Número do processo administrativo |
| `{{Interessado}}` | texto | Nome do contribuinte |
| `{{CPF}}` | CPF com máscara | Identificação física — formato `000.000.000-00` |
| `{{CNPJ}}` | CNPJ com máscara | Identificação jurídica — formato `00.000.000/0000-00` |
| `{{Data}}` | data (DD/MM/AAAA) | Data do parecer |
| `{{DataVistoria}}` | data (DD/MM/AAAA) | Data da vistoria de campo |
| `{{NFSe}}` | texto | Número da nota fiscal de serviço |
| `{{Matrícula}}` | texto | Matrícula do imóvel |

---

## Normalização Estrita de Markdown

O normalizador (`src/lib/markdown-normalizer.ts`) é aplicado **sempre** — tanto ao salvar um arquivo em upload quanto antes de cada parse (preview e geração de DOCX). Isso garante que nenhuma inconsistência de formatação chegue ao documento final.

### Regras impostas

| Tipo de linha | Regra |
|---|---|
| Título PARECER (parágrafo, sem `#`) | Linha em branco obrigatória antes e depois |
| Metadados (`PROCESSO`, `INTERESSADO`, `ASSUNTO`, `CPF`, `CNPJ`, `REF`, `AUTOS`, `ENDEREÇO`, `INSCRIÇÃO`, `VISTORIA`) | Cada linha = bloco isolado com blank antes/depois |
| Data (`Cidade, dd de mês de aaaa` ou `Cidade, {{variável}}`) | Linha em branco obrigatória antes e depois |
| Fecho (`Submeto à douta consideração superior`) | Linha em branco obrigatória antes e depois |
| Títulos com `#` ou `1. **SEÇÃO**` | Linha em branco obrigatória antes e depois |
| Múltiplas linhas em branco | Colapsadas para uma única |
| Espaços à direita | Normalizados: `  ` (hard-break) se intencionais, removidos caso contrário |
| Linhas em branco no início/fim do arquivo | Removidas |

### O que não é alterado

- Parágrafos de corpo (texto corrido) — não são quebrados nem reagrupados
- Itens de lista e suas continuações indentadas
- Formatação inline (`**negrito**`, `*itálico*`, variáveis `{{...}}`)

---

## Pipeline de Geração de Documentos

```
Arquivo em Docs/ (md ou docx)
        │
        ▼
 normalizeMarkdown()          ← garante estrutura estrita (apenas para .md)
        │
        ▼
 markdownToTemplateJson()     ← parse para blocos tipados (heading / paragraph / list)
        │
        ▼
 replaceVariablesInTemplateJson()  ← substitui {{chaves}} pelos valores do formulário
        │
        ▼
 markdownToDocxBuffer()       ← gera DOCX com formatação ABNT via biblioteca docx
        │                         (Times New Roman 12pt, margens, recuos, espaçamentos)
        ▼
 applyMasterEnvelope()        ← injeta o conteúdo dentro do modelo.docx
        │                         preservando cabeçalho, rodapé e sectPr
        ▼
 standardizeDocxXml()         ← pós-processamento XML para templates .docx:
        │                         alinhamentos, recuos e espaçamentos por tipo de bloco
        ▼
    DOCX Final (.docx)
```

Para o preview HTML, o caminho é:

```
Arquivo em Docs/
        │
        ▼
 normalizeMarkdown() + markdownToTemplateJson()
        │
        ▼
 markdownToHtml() com variáveis coloridas (span.var-filled)
        │
        ▼
 normalizeDocumentHtml()     ← pipeline ABNT de 4 fases para o HTML
        │
        ▼
    Preview no navegador
```

---

## Conformidade ABNT

### Formatação aplicada automaticamente

**Parágrafos de corpo:**
- Justificado
- Recuo de primeira linha: 1,25 cm (709 twips)
- Espaçamento entre linhas: 1,5 (360 twips)

**Metadados (PROCESSO, INTERESSADO, etc.):**
- Alinhamento à esquerda
- Sem recuo (firstLine = 0)
- Sem espaçamento antes/depois

**Título PARECER:**
- Centralizado
- Negrito
- 12pt de espaço após

**Data:**
- Alinhamento à direita
- Sem recuo
- 12pt de espaço antes

**Fecho:**
- Alinhamento à esquerda
- Sem recuo
- 6pt de espaço antes

**Títulos de seção (`1. **TÍTULO**`):**
- Negrito, caixa alta
- Espaçamento: 8,47mm antes, 4,23mm depois

**Margens da página:**
- Superior/Esquerda: 3 cm
- Inferior/Direita: 2 cm

### Normalização HTML (4 fases)

A função `normalizeDocumentHtml()` em `html-normalize.ts` aplica:

1. **Purificação** — remove `&nbsp;`, spans vazios, espaços múltiplos e parágrafos vazios
2. **Estrutura** — promove `<p><strong>TÍTULO EM CAIXA ALTA</strong></p>` para `<h1>`/`<h2>`, deduplica headings, normaliza listas manuais
3. **Scanner ABNT** — classifica blocos legais (PARECER, metadados, data, fecho) e aplica as classes CSS correspondentes
4. **Polimento** — colapsa espaçamentos duplicados entre seções

---

## Arquitetura de Código

### `src/lib/markdown-normalizer.ts`

Responsável por garantir a estrutura estrita antes de qualquer parse.

```typescript
normalizeMarkdown(content: string): string
isMarkdownNormalized(content: string): boolean
```

Classifica cada linha em: `empty | heading | list-item | list-continuation | parecer | metadata | date | fecho | body` e reorganiza o documento inserindo as separações obrigatórias.

---

### `src/lib/template-json.ts`

Define a estrutura de dados intermediária `TemplateJsonBlock` e converte markdown para ela.

```typescript
type TemplateJsonBlock =
  | { type: 'heading'; level: 1–6; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }

markdownToTemplateJson(markdown: string): TemplateJsonDocument
extractVariablesFromTemplateJson(doc): string[]
replaceVariablesInTemplateJson(doc, values): TemplateJsonDocument
```

A primeira operação de `markdownToTemplateJson` é chamar `normalizeMarkdown`.

---

### `src/lib/template-markdown.ts`

Converte `TemplateJsonDocument` para HTML (preview) ou para buffer DOCX.

```typescript
markdownToHtml(content, values): string
markdownToDocxBuffer(content, values): Promise<Buffer>
extractVariablesFromMarkdown(content): string[]
```

Constantes ABNT usadas na geração DOCX:

| Constante | Valor | Significado |
|---|---|---|
| `FONT` | `'Times New Roman'` | Fonte padrão |
| `SIZE` | `24` | 12pt (em half-points) |
| `LINE` | `360` | Espaçamento 1,5 (em twips) |
| `MARGIN_3CM` | `1701` twips | Margem 3cm |
| `MARGIN_2CM` | `1134` twips | Margem 2cm |
| `INDENT_125` | `709` twips | Recuo 1,25cm |

---

### `src/lib/template-docx.ts`

Lida com arquivos `.docx` de entrada.

```typescript
extractVariablesFromDocx(buffer: Buffer): string[]
docxToHtml(buffer: Buffer, values: Record<string, string>): Promise<string>
```

Usa mammoth com styleMap completo para conversão semântica. Valores preenchidos são marcados com unicode privado (U+E010/U+E011) para highlighting no preview.

---

### `src/lib/html-normalize.ts`

Normalização ABNT em 4 fases do HTML gerado para o preview.

```typescript
normalizeDocumentHtml(html: string): string
```

---

### `src/app/actions/generate.ts`

Server Action principal. Orquestra a geração do DOCX final.

- Para `.md`: `markdownToDocxBuffer` → `applyMasterEnvelope`
- Para `.docx`: `docxtemplater.render` → `standardizeDocxXml` → `applyMasterEnvelope`

`applyMasterEnvelope` injeta o conteúdo dentro do `model/modelo.docx`, preservando cabeçalho/rodapé e ajustando a margem inferior do `sectPr`.

`standardizeDocxXml` faz pós-processamento XML nos templates `.docx` — aplica alinhamentos, recuos e espaçamentos por tipo de bloco diretamente no XML do Word.

---

### `src/app/actions/upload.ts`

Ao receber um `.md`:
1. Lê o conteúdo do arquivo
2. Aplica `normalizeMarkdown()` — o arquivo salvo em disco já é a versão normalizada
3. Extrai variáveis para validação

Para importação via Google Docs, extrai o ID do documento da URL e usa o endpoint de exportação do Google para baixar como `.docx`.

---

### `src/app/page.tsx`

Componente React principal (client component). Gerencia:
- Seleção de template e persistência de formulário por template (`formDataByTemplate`)
- Tooltip nativo no seletor exibindo o nome completo do modelo ao passar o mouse
- Debounce de 700ms para re-renderização do preview
- Estimativa de contagem de páginas por medição do DOM (296mm × 3.7795 px/mm)
- Modal de upload com suporte a drag-and-drop e importação Google Docs

**Funções auxiliares do formulário:**

`applyMask(name, value)` — aplica máscara progressiva de CPF (`000.000.000-00`) ou CNPJ (`00.000.000/0000-00`) conforme o nome da variável. Descarta não-dígitos e respeita os limites de 11 e 14 dígitos respectivamente.

`formatValuesForOutput(values)` — converte variáveis cujo nome contém `data` do formato interno `AAAA-MM-DD` (padrão do `<input type="date">`) para `DD/MM/AAAA` antes de enviar ao servidor (preview e geração de DOCX).

---

## Referência das Server Actions

### `getTemplates()`
Lista todos os templates em `Docs/`. Retorna `Template[]` com `name`, `filename`, `type` (`markdown` | `docx`), e `variables`.

### `deleteTemplate(filename)`
Remove um arquivo de template de `Docs/`.

### `renderTemplate(filename, values)`
Renderiza o template para HTML de preview com as variáveis aplicadas. Retorna `{ html: string }`.

### `uploadTemplate(formData)`
Recebe um `File` via FormData. Para `.md`: normaliza e salva. Para `.docx`: valida e salva.

### `importFromGoogleDocs(url)`
Importa um Google Docs público como `.docx`. Extrai o ID da URL, faz download pelo endpoint de exportação do Google.

### `generateFilledDocx(filename, values)`
Gera o DOCX final preenchido. Retorna `{ base64: string }` para download pelo cliente.

---

## Referência das Bibliotecas

| Biblioteca | Versão | Uso |
|---|---|---|
| `next` | 16.1.6 | Framework React com Server Actions |
| `react` | 19.2.3 | UI components |
| `docx` | 9.6.1 | Geração programática de DOCX (templates markdown) |
| `docxtemplater` | 3.68.3 | Substituição de variáveis em templates DOCX |
| `pizzip` | 3.2.0 | Manipulação de ZIPs (arquivos DOCX) |
| `mammoth` | 1.12.0 | Conversão DOCX → HTML semântico |
| `framer-motion` | 12.36.0 | Animações de UI |
| `lucide-react` | 0.577.0 | Ícones |

---

## Adicionando Novos Templates

1. Crie um arquivo `.md` em `Docs/` seguindo o [Guia de Padronização](Docs/GUIA_DE_PADRONIZACAO.md)
2. O arquivo aparecerá automaticamente no seletor da interface
3. O normalizador será aplicado na primeira renderização

Ou use a interface: **Carregar Modelo** → arraste o arquivo `.md` ou `.docx`.
