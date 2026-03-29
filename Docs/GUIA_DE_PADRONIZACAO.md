# Guia de Padronização de Templates

Este guia define as regras obrigatórias para a criação e edição de templates de pareceres fiscais no formato Markdown (`.md`).

O sistema aplica um **normalizador estrito** que reorganiza automaticamente qualquer arquivo carregado. Seguir este guia garante que o template seja fiel desde a autoria, sem depender de correção automática.

---

## Sumário

1. [Estrutura obrigatória do documento](#estrutura-obrigatória-do-documento)
2. [Regras de isolamento de blocos](#regras-de-isolamento-de-blocos)
3. [Tipos de bloco e sua formatação](#tipos-de-bloco-e-sua-formatação)
4. [Variáveis](#variáveis)
5. [Títulos de seção](#títulos-de-seção)
6. [Listas](#listas)
7. [Formatação inline](#formatação-inline)
8. [O que NÃO fazer](#o-que-não-fazer)
9. [Exemplo completo](#exemplo-completo)

---

## Estrutura obrigatória do documento

Todo parecer deve seguir esta sequência de blocos:

```
[Linha PARECER]

[Bloco de metadados — um por linha]

[Seções numeradas em negrito]

[Parágrafos de corpo]

[Fecho]

[Linha de data]
```

**Cada bloco especial deve estar separado dos demais por uma linha em branco.** Nunca agrupe dois tipos diferentes de bloco sem linha em branco entre eles.

---

## Regras de isolamento de blocos

O normalizador impõe linha em branco obrigatória antes e depois dos seguintes tipos:

| Tipo de bloco | Identificação |
|---|---|
| Título PARECER | Linha começando com `PARECER` (sem `#`) |
| Metadados | `PROCESSO`, `INTERESSADO`, `ASSUNTO`, `CPF`, `CNPJ`, `REF`, `AUTOS`, `REFERÊNCIA`, `ENDEREÇO`, `INSCRIÇÃO`, `VISTORIA` |
| Data | `Cidade, dd de mês de aaaa` ou `Cidade, {{variavel}}` |
| Fecho | Linha contendo `Submeto à douta consideração superior` |
| Títulos | Linhas com `#` ou no padrão `1. **TÍTULO**` |

Isso significa que escrever:

```markdown
ASSUNTO: Isenção de IPTU
Este é o primeiro parágrafo.
```

Será corrigido automaticamente para:

```markdown
ASSUNTO: Isenção de IPTU

Este é o primeiro parágrafo.
```

---

## Tipos de bloco e sua formatação

### Título do parecer (PARECER)

Representa o identificador do documento. Fica centralizado e em negrito no output.

```markdown
**PARECER DIAAF Nº {{Parecer}}**
```

- Deve ser um parágrafo isolado (linha em branco antes e depois)
- Use `**...**` para negrito
- Nunca use `#` (hashtag) para este bloco

---

### Metadados

Informações processuais. Ficam alinhados à esquerda, sem recuo, no output.

```markdown
PROCESSO Nº: **{{Processo}}**

INTERESSADO: **{{Interessado}}**   CPF: **{{CPF}}**

ASSUNTO: **DESCRIÇÃO DO ASSUNTO**
```

**Regra:** Cada linha de metadado deve ser um parágrafo isolado.

É permitido combinar dois campos na mesma linha (ex: `INTERESSADO` + `CPF`) quando forem complementares e couberem em uma linha:

```markdown
INTERESSADO: **{{Interessado}}**   CNPJ: **{{CNPJ}}**
```

---

### Parágrafos de corpo

Texto corrido de análise jurídica. Ficam justificados com recuo de 1,25cm na primeira linha.

```markdown
Este parecer fundamenta-se no inciso III do art. 36 da Lei Complementar
nº 005/2022, que regulamenta a isenção do IPTU para contribuintes aposentados.
```

- Não use recuo manual (espaços ou tabulações no início da linha)
- Não quebre linhas manualmente dentro do parágrafo (o texto vai justificado automaticamente)
- Para forçar uma quebra de linha dentro do mesmo parágrafo, use dois espaços ao final da linha (`  `)

---

### Fecho

Sentença de encerramento. Fica à esquerda, sem recuo, com pequeno espaço acima.

```markdown
É o parecer. Submeto à douta consideração superior.
```

Deve ser um parágrafo isolado.

---

### Data

Localidade e data do documento. Fica alinhada à direita no output.

```markdown
Imperatriz, {{Data}}
```

O padrão reconhecido é:
- `Cidade, dd de mês de aaaa`
- `Cidade, {{variavel}}`

Deve ser um parágrafo isolado no final do documento.

---

## Variáveis

Variáveis são declaradas com a sintaxe `{{nomeDaVariavel}}` (duplas chaves, sem espaços).

```markdown
PROCESSO Nº: **{{Processo}}**
INTERESSADO: **{{Interessado}}**
```

### Regras gerais

- O nome da variável é sensível a maiúsculas/minúsculas (`{{Data}}` ≠ `{{data}}`)
- Variáveis podem ser usadas dentro de texto corrido, não apenas em metadados
- Não use espaços dentro das chaves: `{{ Processo }}` está incorreto

### Tipos automáticos por nome

O sistema infere o tipo do campo de formulário a partir do nome da variável:

| Nome contém | Tipo de campo | Comportamento no formulário | Formato no documento |
|---|---|---|---|
| `data` | Seletor de data | `<input type="date">` | Convertido para `DD/MM/AAAA` |
| `cpf` | Texto com máscara | Aceita apenas dígitos | Formatado como `000.000.000-00` |
| `cnpj` | Texto com máscara | Aceita apenas dígitos | Formatado como `00.000.000/0000-00` |
| outros | Texto livre | Sem restrição | Exato como digitado |

**Importante para datas:** o campo usa o seletor nativo do navegador, que armazena o valor como `AAAA-MM-DD`. A aplicação converte automaticamente para o padrão brasileiro `DD/MM/AAAA` antes de inserir no preview e no DOCX — não é necessário nenhum ajuste no template.

**Importante para CPF/CNPJ:** a máscara é aplicada progressivamente ao digitar. Apenas dígitos são aceitos; os separadores (`.`, `/`, `-`) são inseridos automaticamente. O valor inserido no documento já inclui a formatação completa.

### Variáveis padrão recomendadas

| Variável | Tipo inferido | Uso |
|---|---|---|
| `{{Parecer}}` | texto | Número do parecer: `001/2025` |
| `{{Processo}}` | texto | Número do processo: `2025.001234-5` |
| `{{Interessado}}` | texto | Nome do contribuinte |
| `{{CPF}}` | CPF com máscara | Pessoa física: `000.000.000-00` |
| `{{CNPJ}}` | CNPJ com máscara | Pessoa jurídica: `00.000.000/0000-00` |
| `{{Data}}` | data (DD/MM/AAAA) | Data do parecer |
| `{{DataVistoria}}` | data (DD/MM/AAAA) | Data de vistoria de campo |

---

## Títulos de seção

Use o padrão numérico em negrito. Ele é automaticamente promovido a `<h2>` no preview e no DOCX.

```markdown
1. **DA BASE LEGAL**

2. **DA CONTEXTUALIZAÇÃO**

3. **DA ANÁLISE DO PEDIDO**

4. **DO PARECER CONCLUSIVO**
```

**Regras:**
- O número deve ser seguido de ponto e espaço: `1. `
- O texto da seção deve estar completamente em `**negrito**`
- Nada mais deve estar na mesma linha
- Sempre deixe linha em branco antes e depois

Para subseções (nível 3), use `#` padrão do markdown:

```markdown
### 1.1 Requisito de Renda
```

---

## Listas

### Lista não-ordenada (marcadores)

```markdown
* Primeiro item
* Segundo item
* Terceiro item
```

Ou com `-`:

```markdown
- Primeiro item
- Segundo item
```

### Lista ordenada (numerada)

```markdown
1. Primeiro item
2. Segundo item
3. Terceiro item
```

**Atenção:** Listas ordenadas que têm o conteúdo inteiro em negrito (`1. **Texto**`) são interpretadas como **títulos de seção**, não como itens de lista. Use negrito parcial para listas comuns:

```markdown
1. **Proventos:** Verificado no extrato de benefício.
2. **Imóvel:** Única propriedade residencial no município.
```

---

## Formatação inline

| Sintaxe | Resultado |
|---|---|
| `**texto**` | **negrito** |
| `*texto*` | *itálico* |
| `***texto***` | ***negrito e itálico*** |

A formatação inline é preservada tanto no preview HTML quanto no DOCX gerado.

---

## O que NÃO fazer

**Não misture tipos de bloco na mesma "pilha" sem linha em branco:**

```markdown
# Errado
PROCESSO Nº: {{Processo}}
INTERESSADO: {{Interessado}}
Este é o primeiro parágrafo do corpo do texto.
```

```markdown
# Correto
PROCESSO Nº: **{{Processo}}**

INTERESSADO: **{{Interessado}}**

Este é o primeiro parágrafo do corpo do texto.
```

---

**Não use `#` para o título PARECER:**

```markdown
# Errado
# PARECER DIAAF Nº {{Parecer}}
```

```markdown
# Correto
**PARECER DIAAF Nº {{Parecer}}**
```

---

**Não use recuo manual em parágrafos de corpo:**

```markdown
# Errado
    Este parágrafo começa com 4 espaços, gerando um bloco de código.
```

```markdown
# Correto
Este parágrafo começa na margem esquerda. O recuo de 1,25cm é aplicado automaticamente.
```

---

**Não quebre linhas de texto corrido com Enter simples:**

```markdown
# Errado — parece dois parágrafos mas vira um parágrafo com join por espaço
Este é o início da frase
e esta linha continua a mesma ideia.
```

```markdown
# Correto — continuação natural (texto justificado automaticamente)
Este é o início da frase e esta linha continua a mesma ideia no mesmo parágrafo.
```

Se precisar de quebra de linha visual dentro do mesmo parágrafo, termine a linha com dois espaços:

```markdown
# Correto — hard break com dois espaços no final da linha
Esta linha termina aqui.
Esta começa na linha seguinte dentro do mesmo bloco.
```

---

**Não esqueça de isolar o fecho e a data:**

```markdown
# Errado
Texto do último parágrafo de análise.
É o parecer. Submeto à douta consideração superior.
Imperatriz, {{Data}}
```

```markdown
# Correto
Texto do último parágrafo de análise.

É o parecer. Submeto à douta consideração superior.

Imperatriz, {{Data}}
```

---

**Não formate datas manualmente nas variáveis de data:**

```markdown
# Errado — o campo já converte automaticamente para DD/MM/AAAA
Imperatriz, {{Data_Formatada}}   ← variável com data já escrita no template
```

```markdown
# Correto — use a variável e deixe o sistema formatar
Imperatriz, {{Data}}
```

---

## Exemplo completo

```markdown
**PARECER DIAAF Nº {{Parecer}}**

PROCESSO Nº: **{{Processo}}**

INTERESSADO: **{{Interessado}}**   CPF: **{{CPF}}**

ASSUNTO: **CONCESSÃO DE ISENÇÃO DO IMPOSTO PREDIAL E TERRITORIAL URBANO (IPTU)**

1. **DA BASE LEGAL**

Este parecer fundamenta-se no inciso III do art. 36 da Lei Complementar nº 005/2022
c/c o art. 10 do Decreto Municipal nº 19/2023, que regulamenta a isenção do IPTU para
contribuintes aposentados, pensionistas ou beneficiários de amparo ao Idoso ou Deficiente.

2. **DA ANÁLISE DO PEDIDO**

Com base na documentação apresentada, verificou-se que o contribuinte atende a todos
os requisitos legais para a concessão do benefício:

1. **Proventos:** Recebe proventos de até um salário-mínimo mensal.
2. **Único imóvel:** Possui imóvel residencial em Imperatriz com matrícula nº {{Matrícula}}.
3. **Área territorial:** O imóvel possui {{Medida}} m², dentro do limite de 300 m².
4. **Vistoria realizada em:** {{DataVistoria}}.

3. **DO PARECER CONCLUSIVO**

Conclui-se que o contribuinte **{{Interessado}}** atende a todos os requisitos para
a concessão da isenção do IPTU referente ao imóvel situado à **{{Endereço}}**.

É o parecer. Submeto à douta consideração superior.

Imperatriz, {{Data}}
```
