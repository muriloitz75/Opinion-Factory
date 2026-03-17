---
name: model-routing
description: Inteligência para selecionar o melhor modelo de IA (Gemini, Claude, GPT) baseado no nível de complexidade da tarefa e quota disponível.
---

# Model Routing Skill

Esta skill define as regras de "Fair Use" e otimização de performance para o Antigravity, baseando-se no catálogo de modelos instalados.

## 📊 Matriz de Seleção

| Nível | Complexidade | Modelos Recomendados | Exemplos de Tarefa |
| :--- | :--- | :--- | :--- |
| **L0** | Trivial | `Gemini 3 Flash` | Correção de typos, leitura de arquivos < 100 linhas, git status, ajuda com CLI. |
| **L1** | Padrão | `Gemini 3.1 Pro (Low)` ou `GPT-OSS 120B` | Refatoração de funções isoladas, criação de componentes simples, escrita de documentação. |
| **L2** | Avançado | `Gemini 3.1 Pro (High)` ou `Claude Sonnet 4.6 (Thinking)` | Debugging complexo, mudanças Multi-arquivo, otimização de performance profunda. |
| **L3** | Crítico | `Claude Opus 4.6 (Thinking)` | Arquitetura de sistema, Auditoria de Segurança, Refatoração Legada (Legacy Cleanup). |

## 🚦 Protocolo de Decisão

### 1. Estimativa de Esforço
O orquestrador deve avaliar:
- **Scope**: Quantos arquivos serão editados? (>3 = L2 ou L3).
- **Size**: Tamanho dos arquivos? (>500 linhas = L2).
- **Risk**: A tarefa envolve segurança (auth, db, secrets)? (Sempre L2 ou L3).

### 2. Gestão de Quota
Se um modelo de alto nível estiver com baixa quota:
- Recomendar downgrade para `Flash` ou `Low` se a tarefa permitir.
- Avisar o usuário antes de prosseguir com um modelo de alto custo em tarefas simples.

### 3. Modo "Thinking" (Claude)
- Ativar apenas quando a lógica for ambígua ou exigir alta capacidade de raciocínio.
- Desativar para tarefas de "escrita mecânica" (boilerplate, preenchimento de dados repetitivos).

## 🛠️ Orquestração Automatizada
Ao identificar a tarefa, o agente deve sugerir:
"A tarefa [X] tem complexidade nível [N]. Sugiro usar [Modelo] para garantir [Qualidade/Economia]."
