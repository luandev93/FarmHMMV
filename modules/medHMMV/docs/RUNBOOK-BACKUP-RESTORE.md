# RUNBOOK — Backup e Restauração: medHMMV

> Procedimentos de backup e restauração para o módulo Médico.

---

## 1. Estratégia de Backup

| Tipo | Frequência | Retenção |
|------|-----------|----------|
| Full dump | Diário (03:00) | 30 dias |
| WAL | Contínuo | 7 dias |

**RPO**: ≤ 1 hora | **RTO**: ≤ 4 horas

---

## 2. Backup Manual

```bash
export BACKUP_DIR="/backups/medico"
export BACKUP_FILE="${BACKUP_DIR}/medico_$(date +%Y%m%d_%H%M%S).dump"

mkdir -p $BACKUP_DIR

pg_dump \
  --host=$PGHOST \
  --port=${PGPORT:-5432} \
  --username=$PGUSER \
  --dbname=$PGDATABASE \
  --format=custom \
  --compress=9 \
  --file=$BACKUP_FILE

echo "Backup: $BACKUP_FILE"
```

---

## 3. Verificar Integridade

```bash
pg_restore --list $BACKUP_FILE | head -20
```

---

## 4. Restaurar

```bash
export BACKUP_FILE="/backups/medico/medico_20240101_030000.dump"
export DB_RESTORE="medico_hmmv_restore"

createdb --host=$PGHOST --username=$PGUSER $DB_RESTORE

pg_restore \
  --host=$PGHOST \
  --username=$PGUSER \
  --dbname=$DB_RESTORE \
  --verbose \
  $BACKUP_FILE

# Validar
psql --host=$PGHOST --username=$PGUSER --dbname=$DB_RESTORE \
  -c "SELECT 'consultas', COUNT(*) FROM consultas
      UNION ALL SELECT 'prescricoes', COUNT(*) FROM prescricoes
      UNION ALL SELECT 'auditoria', COUNT(*) FROM auditoria;"

# Renomear bancos (parar app antes)
psql --host=$PGHOST --username=$PGUSER \
  -c "ALTER DATABASE medico_hmmv RENAME TO medico_hmmv_bak;"
psql --host=$PGHOST --username=$PGUSER \
  -c "ALTER DATABASE $DB_RESTORE RENAME TO medico_hmmv;"

pm2 restart medico-hmmv
```

---

## 5. Rollback de Migração

1. Parar aplicação: `pm2 stop medico-hmmv`
2. Restaurar backup (seção 4)
3. Checkout versão anterior: `git checkout tags/v-anterior`
4. Regenerar: `npm run prisma:generate`
5. Reiniciar: `pm2 start medico-hmmv`

---

## 6. Backup Automático (cron)

```bash
0 3 * * * /opt/scripts/backup_medico.sh >> /var/log/backup_medico.log 2>&1
0 4 * * * find /backups/medico -name "*.dump" -mtime +30 -delete
```

---

## 7. Custos de Armazenamento

| Solução | Custo estimado |
|---------|----------------|
| Disco local | Gratuito |
| Backblaze B2 | ~$0,006/GB/mês |
| AWS S3 | ~$0,023/GB/mês |

---

## 8. Contatos

| Papel | Contato |
|-------|---------|
| DBA / Responsável técnico | |
| Provedor de hospedagem | |
