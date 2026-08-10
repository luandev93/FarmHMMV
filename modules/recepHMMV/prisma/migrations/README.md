# Migrações do módulo Recepção (recepHMMV)

## Política de migrações
- **Nunca** usar `DROP TABLE`, `DROP COLUMN` ou `TRUNCATE` em migrações.
- Novos campos devem ser adicionados como **nullable** ou com **DEFAULT**.
- Colunas removidas da aplicação devem ser primeiro marcadas como opcionais,
  depois arquivadas (renomeadas p/ ex. `_deprecated_campo`), e só então
  removidas em uma janela de manutenção planejada.
- Toda migração deve ser testada em ambiente de homologação antes de produção.

## Como gerar uma nova migração

```bash
# Cria a migração (arquivo SQL) sem aplicar ao banco
npx prisma migrate dev --name descricao_da_migracao

# Aplica migrações pendentes em produção
npx prisma migrate deploy
```

## Restaurar estado em caso de falha

Consulte o `docs/RUNBOOK-BACKUP-RESTORE.md` para procedimentos de rollback.
