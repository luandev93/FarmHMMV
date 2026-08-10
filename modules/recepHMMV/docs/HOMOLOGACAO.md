# Checklist de Homologação — recepHMMV

> Preencha este documento antes de cada entrada em produção.
> **Data de revisão**: ___________  
> **Responsável técnico**: ___________  
> **Versão**: ___________

---

## 1. Segurança

| Item | Status | Observação |
|------|--------|------------|
| JWT_SECRET com ≥ 32 chars configurado | ☐ | |
| JWT_SECRET diferente entre ambientes | ☐ | |
| CORS restrito às origens corretas | ☐ | |
| Rate limit ativo e testado | ☐ | |
| Helmet retornando cabeçalhos seguros | ☐ | |
| HTTPS configurado em produção | ☐ | |
| RBAC testado para cada papel/rota | ☐ | |
| API Key entre módulos configurada | ☐ | |
| Secrets não versionados no Git | ☐ | |

---

## 2. Integridade de Dados

| Item | Status | Observação |
|------|--------|------------|
| Migrações aplicadas sem erros | ☐ | |
| Constraints de unicidade funcionando (CPF/CNS) | ☐ | |
| Upsert de paciente não sobrescreve dados críticos | ☐ | |
| Transições de estado respeitando o mapa permitido | ☐ | |
| Auditoria gravando para todas as ações críticas | ☐ | |
| REVOKE UPDATE/DELETE na tabela auditoria aplicado | ☐ | |
| Backup automático configurado | ☐ | |
| Teste de restauração executado | ☐ | |

---

## 3. Workflow entre Módulos

| Item | Status | Observação |
|------|--------|------------|
| Evento PATIENT_TRANSFERRED chega no medHMMV | ☐ | |
| Retry de integração testado com falha simulada | ☐ | |
| correlationId propagado entre serviços | ☐ | |
| Idempotência de enfileiramento testada | ☐ | |
| Fluxo completo: cadastro → triagem → fila → médico | ☐ | |

---

## 4. Backup e Recuperação

| Item | Status | Observação |
|------|--------|------------|
| Script de backup automático configurado | ☐ | |
| Backup testado em ambiente de homologação | ☐ | |
| Restauração testada e documentada | ☐ | |
| RPO (Recovery Point Objective) definido | ☐ | ex.: 1h |
| RTO (Recovery Time Objective) definido | ☐ | ex.: 4h |
| Backup offsite configurado | ☐ | |

---

## 5. Observabilidade e Operação

| Item | Status | Observação |
|------|--------|------------|
| Logs estruturados em produção | ☐ | |
| /health respondendo corretamente | ☐ | |
| Alertas de erro configurados | ☐ | |
| Dashboard de monitoramento disponível | ☐ | |
| Runbook de incidentes documentado | ☐ | |

---

## 6. Testes e Qualidade

| Item | Status | Observação |
|------|--------|------------|
| Testes de smoke passando | ☐ | `npm test` |
| Lint sem erros | ☐ | `npm run lint` |
| Cenários de erro validados manualmente | ☐ | |
| CPF/CNS inválido rejeitado na API | ☐ | |
| Payload malformado retorna 422 | ☐ | |
| Token expirado retorna 401 | ☐ | |

---

## 7. Compliance / LGPD

| Item | Status | Observação |
|------|--------|------------|
| Dados de paciente não retornam em logs | ☐ | |
| CPF/CNS mascarado nos logs de auditoria | ☐ | |
| Política de retenção de dados definida | ☐ | |
| Responsável pelo tratamento de dados (DPO) identificado | ☐ | |
| Base legal para coleta documentada | ☐ | Art. 11 LGPD (saúde) |

---

## 8. Free-first / Custos

| Item | Status | Observação |
|------|--------|------------|
| Infraestrutura local documentada funciona | ☐ | `docker compose up` |
| Limite do tier gratuito documentado | ☐ | |
| Plano de escalonamento com custos estimados | ☐ | |

---

## Assinaturas

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Responsável técnico | | | |
| Farmacêutico/Enfermeiro responsável | | | |
| Gestor hospitalar | | | |
