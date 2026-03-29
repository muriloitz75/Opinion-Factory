# Regras de Conformidade ABNT

Estas regras se aplicam a qualquer código que gere, processe ou exiba documentos.

## Tipografia e Layout

- Fonte: Times New Roman 12pt
- Margens: esquerda 3cm — inferior/direita 2cm
- Margem superior DOCX: `w:top=2152` twips (~3,8cm) — calculada para garantir 12pt entre a linha separadora do cabeçalho institucional e o início do texto em todas as páginas
- Espaçamento entre linhas: 1,5 (360 twips em DOCX)
- Recuo de primeira linha: 1,25cm

## Estrutura de Blocos

Cada bloco de documento tem classe CSS e estilo de parágrafo DOCX distintos:

| Tipo       | Classe CSS                        | Uso                                      |
|------------|-----------------------------------|------------------------------------------|
| `parecer`  | `abnt-centered abnt-parecer`      | Linha "PARECER Nº ..."                   |
| `metadata` | `abnt-no-indent abnt-left`        | Linhas de cabeçalho (Interessado, etc.)  |
| `date`     | `abnt-right abnt-data-block`      | Linha de data                            |
| `section`  | `<h1>` / `<h2>` / `<h3>`         | Títulos de seção — **12pt superior, 8pt inferior** |
| `closing`  | `abnt-no-indent abnt-closing`     | Encerramento e assinatura — **8pt superior** — detectado por **posição** (último parágrafo de corpo antes do bloco de data), com conteúdo como fallback |
| `body`     | *(padrão)*                        | Parágrafos de corpo — recuo 1,25cm       |

## Normalização de Markdown

`src/lib/markdown-normalizer.ts` é a fonte de verdade para estrutura ABNT em arquivos `.md`:
- Linhas em branco obrigatórias ao redor de PARECER
- Linhas de metadados, títulos de seção e encerramentos seguem padrão rígido
- **Nunca contornar ou desativar esta normalização**

## HTML

`src/lib/html-normalize.ts` aplica 4 fases de normalização ABNT ao HTML gerado para pré-visualização. Qualquer alteração no layout visual deve passar por esta função.

| Fase | Nome             | O que faz                                                          |
|------|------------------|--------------------------------------------------------------------|
| 1    | Purificação      | Remove `&nbsp;`, spans vazios, parágrafos `<p>` completamente vazios |
| 2    | Estrutura        | Promove `<p><strong>CAIXA ALTA</strong></p>` para `<h1>`–`<h3>`, agrupa listas `<ul>` consecutivas |
| 3    | Blocos Legais    | Aplica classes ABNT a blocos de parecer, metadados, data e fecho  |
| 4    | Polimento        | Colapsa múltiplos espaços em branco entre blocos                  |

> **Nota:** `removeHeadingIndent()` foi removida do pipeline (Fase 3). A regra ABNT de "sem recuo no 1º parágrafo após título" é da norma acadêmica e não se aplica a pareceres fiscais, onde todos os parágrafos de corpo recebem recuo.
