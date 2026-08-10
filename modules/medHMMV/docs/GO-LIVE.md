# GO-LIVE — medHMMV

> Procedimento de entrada em produção do módulo Médico.

---

## Pré-requisitos

- [ ] Checklist `HOMOLOGACAO.md` aprovado
- [ ] Acesso ao servidor de produção
- [ ] PostgreSQL provisionado
- [ ] Variáveis de ambiente configuradas
- [ ] Módulo `recepHMMV` em produção e respondendo
- [ ] Módulo `farmHMMV` em produção e respondendo
- [ ] Backup do estado atual (se upgrade)

---

## Passo 1: Variáveis de ambiente

```bash
cp .env.example .env.prod
# Gerar JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Gerar MED_API_KEY:
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## Passo 2: Instalar e preparar

```bash
npm ci --omit=dev
npm run prisma:generate
```

---

## Passo 3: Aplicar migrações

```bash
# ANTES de subir a aplicação
npm run prisma:migrate
```

---

## Passo 4: Iniciar

```bash
# Com PM2
pm2 start src/app.js --name medico-hmmv --env production

# OU Docker
docker compose -f docker-compose.prod.yml up -d
```

---

## Passo 5: Verificação pós-deploy

```bash
curl https://seu-dominio.com/health
# Esperado: { "servico": "medHMMV", "status": "ok", "banco": "ok" }
```

- [ ] `/health` ok
- [ ] Início de consulta funciona
- [ ] Prescrição criada e enviada à farmácia
- [ ] Desfecho notifica recepção

---

## Rollback

```bash
git checkout tags/v-anterior
npm ci --omit=dev
npm run prisma:generate
pm2 restart medico-hmmv
# Se necessário, restaurar banco via RUNBOOK-BACKUP-RESTORE.md
```

---

## Contatos

| Papel | Nome | Contato |
|-------|------|---------|
| Responsável técnico | | |
| DBA | | |
| Médico responsável | | |
