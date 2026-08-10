# GO-LIVE — recepHMMV

> Procedimento de entrada em produção do módulo Recepção.  
> Siga os passos em ordem. Só avance se o item anterior for concluído.

---

## Pré-requisitos

- [ ] Checklist de `HOMOLOGACAO.md` preenchido e aprovado
- [ ] Acesso SSH ao servidor de produção
- [ ] Banco de dados PostgreSQL provisionado e acessível
- [ ] Variáveis de ambiente configuradas no ambiente de produção
- [ ] Backup do estado atual do banco realizado (se upgrade)

---

## Passo 1: Preparar variáveis de ambiente

```bash
# Copie e preencha com valores REAIS de produção
cp .env.example .env.prod

# Variáveis críticas obrigatórias:
# - JWT_SECRET: mínimo 32 caracteres, gerado aleatoriamente
#   Sugestão: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# - DATABASE_URL: conexão com banco de produção
# - CORS_ORIGINS: apenas origins do frontend de produção
# - NODE_ENV: production
```

---

## Passo 2: Instalar dependências de produção

```bash
npm ci --omit=dev
npm run prisma:generate
```

---

## Passo 3: Aplicar migrações

```bash
# ATENÇÃO: executar ANTES de subir a nova versão da aplicação
# Migrações são idempotentes e não-destrutivas
npm run prisma:migrate
```

Em caso de erro na migração:
1. NÃO suba a aplicação.
2. Consulte `RUNBOOK-BACKUP-RESTORE.md`.
3. Acione o responsável técnico.

---

## Passo 4: Iniciar a aplicação

```bash
# Com PM2 (recomendado para produção sem Kubernetes)
npm install -g pm2
pm2 start src/app.js --name recepcao-hmmv --env production

# OU com Docker
docker compose -f docker-compose.prod.yml up -d
```

---

## Passo 5: Verificação pós-deploy

```bash
# Verifica saúde do serviço
curl https://seu-dominio.com/health

# Resposta esperada:
# { "servico": "recepHMMV", "status": "ok", "banco": "ok" }
```

- [ ] `/health` retorna `status: ok` e `banco: ok`
- [ ] Login de teste funciona
- [ ] Cadastro de paciente funciona
- [ ] Criação de atendimento funciona
- [ ] Fila lista corretamente

---

## Passo 6: Monitoramento pós-go-live (primeiras 24h)

- [ ] Acompanhar logs de erro: `pm2 logs recepcao-hmmv --err`
- [ ] Verificar uso de CPU/memória
- [ ] Confirmar que auditoria está gravando
- [ ] Confirmar que integração com medHMMV está funcionando

---

## Rollback de emergência

Se algo der errado após o go-live:

```bash
# 1. Reverter para versão anterior
git checkout tags/v-anterior
npm ci --omit=dev
npm run prisma:generate

# 2. Reiniciar serviço
pm2 restart recepcao-hmmv

# 3. Se a migração causou problema, restaurar backup
# Consultar RUNBOOK-BACKUP-RESTORE.md
```

---

## Contatos de suporte

| Papel | Nome | Contato |
|-------|------|---------|
| Responsável técnico | | |
| DBA / Infra | | |
| Gestor hospitalar | | |
