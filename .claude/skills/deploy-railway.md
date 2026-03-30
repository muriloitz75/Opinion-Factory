# Skill: deploy-railway

Preparar e executar o deploy da Opinion Factory na plataforma Railway.

## Como usar

`/deploy-railway`

Sem argumentos — a skill executa o fluxo completo de preparação e deploy.

---

## Protocolo de Deploy

### Fase 1 — Pré-voo (verificações obrigatórias)

Execute cada verificação antes de continuar:

**1.1 Arquivos de runtime no git**

Os arquivos abaixo são lidos pelo servidor em tempo de execução — precisam estar commitados:

```bash
git ls-files Docs/ model/modelo.docx
```

Se algum estiver ausente, adicione ao git:

```bash
git add Docs/ model/modelo.docx
git commit -m "chore: inclui templates e modelo no repositório para deploy"
```

**1.2 Build local limpa**

```bash
npm run build
```

Corrija qualquer erro de TypeScript ou ESLint antes de prosseguir. Em Railway o build falha da mesma forma.

**1.3 Verificar `.gitignore`**

Confirme que `Docs/` e `model/` **não** estão listados no `.gitignore`. Se estiverem, remova as entradas.

---

### Fase 2 — Criar `railway.json`

Crie o arquivo na raiz do projeto com o seguinte conteúdo:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

Commite:

```bash
git add railway.json
git commit -m "chore: adiciona configuração Railway"
```

---

### Fase 3 — Deploy

#### Opção A — Via CLI Railway (recomendado)

```bash
# Instalar CLI (se não tiver)
npm install -g @railway/cli

# Login
railway login

# Criar projeto novo (primeira vez) OU vincular existente
railway init          # projeto novo
# ou
railway link          # vincular projeto existente

# Deploy
railway up
```

#### Opção B — Via GitHub (CI/CD automático)

1. Faça push da branch `main` para o GitHub
2. No painel Railway → **New Project** → **Deploy from GitHub repo**
3. Selecione o repositório — Railway detecta Next.js automaticamente
4. A partir daqui, todo push para `main` dispara um novo deploy

---

### Fase 4 — Variáveis de ambiente no Railway

No painel Railway → projeto → **Variables**, configure:

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Sim |
| `PORT` | (Railway injeta automaticamente) | — |

> O Next.js lê `PORT` automaticamente via Railway — não defina manualmente.

Se o projeto adicionar variáveis próprias no futuro (chaves de API, etc.), adicione aqui antes do próximo deploy.

---

### Fase 5 — Verificação pós-deploy

Após o deploy concluir:

- [ ] Acessar a URL gerada pelo Railway (ex: `https://opinion-factory-production.up.railway.app`)
- [ ] Selecionar um template na lista — a lista vem de `Docs/` via filesystem
- [ ] Preencher variáveis e clicar em **Gerar DOCX** — deve baixar o arquivo
- [ ] Verificar que o DOCX gerado tem cabeçalho/rodapé (envelope mestre aplicado)
- [ ] Testar pré-visualização HTML com debounce de 700ms

---

## Problemas Comuns

### Templates não aparecem na lista

**Causa:** `Docs/` não está commitado no git.
**Fix:** `git add Docs/ && git commit -m "fix: adiciona templates ao repositório"`

### Erro `ENOENT model/modelo.docx`

**Causa:** `model/modelo.docx` não está no repositório.
**Fix:** `git add model/modelo.docx && git commit -m "fix: adiciona modelo mestre"`

### Build falha com erro de tipo TypeScript

**Causa:** Erros de tipo que passam em dev mas falham no build de produção.
**Fix:** Execute `npm run build` localmente, corrija os erros reportados.

### `npm run start` falha com porta em uso

**Causa:** Raramente ocorre no Railway — a plataforma injeta `$PORT` corretamente.
**Fix:** Nunca hardcode a porta no código; use `process.env.PORT`.

### Arquivo grande / timeout no build

**Causa:** `node_modules` sendo copiado (não deveria).
**Fix:** Confirme que `.gitignore` contém `node_modules/`. O Nixpacks instala as dependências automaticamente.

---

## Notas de Arquitetura para Railway

- **Server Actions** funcionam nativamente — Railway executa Node.js full-stack, sem restrições de Edge Runtime
- **Filesystem em runtime:** `Docs/` e `model/modelo.docx` são lidos com `fs` em Server Actions — isso funciona no Railway (plataforma de containers com disco efêmero, mas os arquivos vêm do build)
- **Sem banco de dados:** a aplicação é stateless — não há nada além do filesystem de build para persistir
- **PDF via iframe:** a geração de PDF ocorre inteiramente no cliente (browser) — sem impacto no servidor Railway
