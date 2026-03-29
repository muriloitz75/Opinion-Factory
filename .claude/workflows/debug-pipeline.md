# Workflow: debug-pipeline

**Gatilho:** Manual — `/debug-pipeline [descrição do problema]` ou via orchestrator

## O que faz

Investigação estruturada de falhas no pipeline de processamento de documentos:

```
1. trace_pipeline    → docx-processor MCP: executa etapa a etapa
2. testes isolados   → test-runner MCP: roda testes do módulo suspeito
3. diagnóstico       → debug-agent: identifica a etapa com falha
4. correção          → debug-agent: aplica correção mínima
5. reconfirmação     → test-runner MCP: confirma que os testes passam
```

## Quando usar

- DOCX gerado está corrompido ou vazio
- Variáveis `{{x}}` aparecem sem substituição no documento final
- Pré-visualização HTML não reflete o conteúdo do template
- Cabeçalho ou rodapé institucional sumiu do documento gerado
- Comportamento diferente entre template `.md` e `.docx`

## Sequência de delegação (orchestrator)

```
orchestrator recebe: "[problema] em [template]"
  │
  ├─→ pipeline-agent
  │     └─ tool: trace_pipeline(filename, {})
  │        → identifica etapa divergente
  │
  ├─→ debug-agent
  │     ├─ lê arquivo da etapa suspeita
  │     ├─ adiciona logs temporários
  │     └─ propõe correção mínima
  │
  ├─→ test-agent
  │     ├─ tool: run_test_file(arquivo relevante)
  │     └─ cria teste de regressão se não existir
  │
  └─→ [relatório: causa raiz, arquivo:linha, correção aplicada]
```

## Mapa de sintomas → etapa suspeita

| Sintoma | Etapa | Arquivo |
|---------|-------|---------|
| `{{var}}` não substituído | `replaceVariablesInTemplateJson` | `src/lib/template-json.ts` |
| Markdown malformado | `normalizeMarkdown` | `src/lib/markdown-normalizer.ts` |
| HTML sem classes ABNT | `normalizeDocumentHtml` | `src/lib/html-normalize.ts` |
| DOCX gerado inválido (não abre) | `markdownToDocxBuffer` | `src/lib/template-markdown.ts` |
| Sem cabeçalho institucional | `applyMasterEnvelope` | `src/app/actions/generate.ts` |
| Preview diferente do DOCX | `docxToHtml` vs `markdownToDocxBuffer` | ambos |
