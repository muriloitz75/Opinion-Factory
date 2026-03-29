# Skill: debug

Investigar e resolver problemas no projeto Opinion Factory.

## Como usar

`/debug [descrição do problema]`

Exemplos:
- `/debug geração de DOCX retorna arquivo corrompido`
- `/debug variáveis não estão sendo substituídas`
- `/debug pré-visualização HTML não atualiza`

## Protocolo de investigação

### 1. Identificar a camada com problema

| Sintoma                                  | Camada suspeita                          |
|------------------------------------------|------------------------------------------|
| Erro ao gerar DOCX                       | `actions/generate.ts`                   |
| Variáveis `{{x}}` aparecem sem substituir| `src/lib/parser.ts` ou `template-*.ts`  |
| Pré-visualização HTML errada             | `src/lib/html-normalize.ts`             |
| Markdown mal formatado                   | `src/lib/markdown-normalizer.ts`        |
| Upload falha                             | `actions/upload.ts`                     |
| Cabeçalho/rodapé sumiu                   | `applyMasterEnvelope()` em `generate.ts`|

### 2. Rastrear o pipeline

**Markdown:**
```
normalizeMarkdown() → markdownToTemplateJson() → replaceVariables() → markdownToDocxBuffer() → applyMasterEnvelope()
```
**DOCX:**
```
docxtemplater.render() → standardizeDocxXml() → applyMasterEnvelope()
```

Adicione `console.log` temporário em cada etapa para isolar onde a saída diverge do esperado.

### 3. Server Actions

- Server Actions rodam no servidor (Node.js) — erros aparecem no terminal do `npm run dev`, não no browser
- Para inspecionar o payload de uma action, logue o argumento de entrada antes do processamento

### 4. Checklist antes de escalar

- [ ] O template tem a sintaxe correta `{{nomeVariavel}}`?
- [ ] O `modelo.docx` está presente em `model/modelo.docx`?
- [ ] O arquivo em `Docs/` é `.md` ou `.docx` (outros formatos não são suportados)?
- [ ] O erro aparece só em produção? Rode `npm run build && npm run start` para reproduzir
