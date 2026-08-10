# RUNBOOK — Backup e Restauração: recepHMMV

> Este documento descreve os procedimentos de backup e restauração
> do banco de dados PostgreSQL do módulo Recepção.

---

## 1. Estratégia de Backup

| Tipo | Frequência | Retenção | Ferramenta |
|------|-----------|----------|------------|
| Full dump | Diário (02:00) | 30 dias | pg_dump |
| WAL (Point-in-Time) | Contínuo | 7 dias | pgBackRest (opcional, para RTO baixo) |
| Snapshot de volume | Semanal | 4 semanas | Dependente do provedor |

**RPO (Recovery Point Objective)**: ≤ 1 hora (com WAL) / 24h (apenas dump diário).  
**RTO (Recovery Time Objective)**: ≤ 4 horas.

---

## 2. Realizar Backup Manual (pg_dump)

```bash
# Variáveis de ambiente necessárias:
# PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE

export BACKUP_DIR="/backups/recepcao"
export BACKUP_FILE="${BACKUP_DIR}/recepcao_$(date +%Y%m%d_%H%M%S).dump"

mkdir -p $BACKUP_DIR

pg_dump \
  --host=$PGHOST \
  --port=${PGPORT:-5432} \
  --username=$PGUSER \
  --dbname=$PGDATABASE \
  --format=custom \
  --compress=9 \
  --file=$BACKUP_FILE

echo "Backup criado: $BACKUP_FILE"
```

---

## 3. Verificar Integridade do Backup

```bash
# Testa leitura do arquivo sem restaurar
pg_restore --list $BACKUP_FILE | head -20
echo "Integridade: OK (código de saída: $?)"
```

---

## 4. Restaurar Backup

> ⚠️ **ATENÇÃO**: A restauração sobrescreve dados existentes.  
> Execute apenas após aprovação do gestor técnico.

```bash
export BACKUP_FILE="/backups/recepcao/recepcao_20240101_020000.dump"
export DB_RESTORE="recepcao_hmmv_restore" # banco temporário para validação

# 1. Criar banco temporário para restauração teste
createdb --host=$PGHOST --username=$PGUSER $DB_RESTORE

# 2. Restaurar
pg_restore \
  --host=$PGHOST \
  --port=${PGPORT:-5432} \
  --username=$PGUSER \
  --dbname=$DB_RESTORE \
  --verbose \
  $BACKUP_FILE

# 3. Validar contagens de registros
psql --host=$PGHOST --username=$PGUSER --dbname=$DB_RESTORE \
  -c "SELECT 'pacientes', COUNT(*) FROM pacientes
      UNION ALL SELECT 'atendimentos', COUNT(*) FROM atendimentos
      UNION ALL SELECT 'auditoria', COUNT(*) FROM auditoria;"

# 4. Se validação OK, renomear bancos
# (parar aplicação antes)
psql --host=$PGHOST --username=$PGUSER \
  -c "ALTER DATABASE recepcao_hmmv RENAME TO recepcao_hmmv_bak;"
psql --host=$PGHOST --username=$PGUSER \
  -c "ALTER DATABASE $DB_RESTORE RENAME TO recepcao_hmmv;"

# 5. Reiniciar aplicação
pm2 restart recepcao-hmmv
```

---

## 5. Rollback de Migração

O Prisma não suporta rollback automático de migrações. Procedimento manual:

```bash
# 1. Pare a aplicação
pm2 stop recepcao-hmmv

# 2. Restaure o backup tomado ANTES da migração (seção 4)

# 3. Faça checkout da versão anterior do código
git checkout tags/v-anterior

# 4. Regenere o cliente Prisma
npm run prisma:generate

# 5. Reinicie a aplicação
pm2 start recepcao-hmmv
```

---

## 6. Backup Automático (crontab)

```bash
# Adicionar ao crontab do servidor (crontab -e)
# Backup diário às 02:00
0 2 * * * /opt/scripts/backup_recepcao.sh >> /var/log/backup_recepcao.log 2>&1

# Limpeza de backups com mais de 30 dias
0 3 * * * find /backups/recepcao -name "*.dump" -mtime +30 -delete
```

---

## 7. Custos de Armazenamento de Backup

| Solução | Custo |
|---------|-------|
| Disco local | Gratuito (limitado pelo hardware) |
| S3-compatible (ex.: Backblaze B2) | ~$0,006/GB/mês |
| AWS S3 + Lifecycle | ~$0,023/GB/mês (Standard) |
| Supabase (banco gerenciado) | Backup incluído no plano pago |

---

## 8. Contatos de Emergência

| Papel | Contato |
|-------|---------|
| DBA / Responsável técnico | |
| Provedor de hospedagem | |
| Gestor hospitalar | |
