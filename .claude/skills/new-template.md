# Skill: new-template

Criar um novo template de parecer seguindo os padrões ABNT do projeto.

## Como usar

`/new-template [nome do template]`

Exemplos:
- `/new-template parecer-credito-pis`
- `/new-template consulta-icms`

## Formato Markdown (`.md`)

Salvar em `Docs/nome-do-template.md`. Estrutura obrigatória:

```markdown
PARECER Nº {{numeroParecer}}/{{ano}}

INTERESSADO: {{nomeInteressado}}
ASSUNTO: {{assunto}}
PROCESSO: {{numeroProcesso}}

{{cidade}}, {{data}}.

I — RELATÓRIO

{{textoRelatorio}}

II — FUNDAMENTAÇÃO

{{textoFundamentacao}}

III — CONCLUSÃO

{{textoConclusao}}

{{nomeAssinante}}
{{cargo}}
```

## Regras de variáveis

- Use `{{camelCase}}` — sem espaços, sem acentos no nome
- Nomes especiais com comportamento automático:
  - `data` → seletor de data (DD/MM/AAAA)
  - `cpf` → máscara de CPF
  - `cnpj` → máscara de CNPJ

## Checklist antes de salvar

- [ ] Linha `PARECER Nº ...` está na primeira linha (sem linha em branco antes)
- [ ] Existe linha em branco após o título PARECER
- [ ] Metadados (INTERESSADO, ASSUNTO, PROCESSO) estão em linhas separadas
- [ ] Existe linha em branco entre metadados e a linha de cidade/data
- [ ] Títulos de seção seguem o padrão `NUMERAL ROMANO — NOME EM MAIÚSCULAS`
- [ ] Encerramento (nome + cargo) está no final, após linha em branco

## Validação automática

Ao salvar, `src/lib/markdown-normalizer.ts` aplica normalização ABNT automaticamente. Se a estrutura estiver errada, o normalizador pode reordenar ou corrigir blocos — revise a pré-visualização após salvar.

## Formato DOCX (`.docx`)

Para templates DOCX, use o Word com a sintaxe `{nomeVariavel}` (docxtemplater) e salve em `Docs/`. O envelope mestre (`model/modelo.docx`) é aplicado automaticamente na geração.
