# Regras de Interface (UI)

## Idioma

- Todos os textos, labels, mensagens de erro e placeholders devem estar em **português (pt-BR)**
- Nunca usar inglês para conteúdo visível ao usuário

## Comportamento

- Pré-visualização ao vivo com debounce de **700ms** — não reduzir este valor
- Contagem de páginas estimada por medição DOM: `297mm × 3,7795 px/mm`

## Entrada de Dados

Tipos de input detectados automaticamente pelo nome da variável:

| Sufixo/nome | Tipo de input       | Formatação        |
|-------------|---------------------|-------------------|
| `data`      | seletor de data     | DD/MM/AAAA        |
| `cpf`       | texto com máscara   | 000.000.000-00    |
| `cnpj`      | texto com máscara   | 00.000.000/0000-00|
| demais      | texto livre         | —                 |

## Upload e Importação

- Upload aceita arrastar e soltar (`.md` e `.docx`)
- Importação do Google Docs via URL pública → converte para `.docx`
