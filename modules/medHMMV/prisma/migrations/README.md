# Migrações do módulo Médico (medHMMV)

## Política de migrações
- **Nunca** usar `DROP TABLE`, `DROP COLUMN` ou `TRUNCATE`.
- Novos campos como nullable ou com DEFAULT.
- Colunas obsoletas: marcar como opcionais → renomear → remover em janela planejada.

## Como gerar uma nova migração

```bash
npx prisma migrate dev --name descricao_da_migracao
npx prisma migrate deploy  # produção
```

## Rollback
Consulte `docs/RUNBOOK-BACKUP-RESTORE.md`.
