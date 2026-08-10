# Checklist de Homologação — medHMMV

> **Data de revisão**: ___________  
> **Responsável técnico**: ___________  
> **Versão**: ___________

---

## 1. Segurança

| Item | Status | Observação |
|------|--------|------------|
| JWT_SECRET ≥ 32 chars configurado | ☐ | |
| MED_API_KEY configurada | ☐ | |
| CORS restrito às origens corretas | ☐ | |
| Rate limit ativo e testado | ☐ | |
| Helmet configurado | ☐ | |
| HTTPS em produção | ☐ | |
| RBAC testado por papel/rota | ☐ | |
| Endpoint /eventos exige API Key válida | ☐ | |
| Secrets não versionados | ☐ | |

---

## 2. Integridade de Dados

| Item | Status | Observação |
|------|--------|------------|
| Migrações sem erros | ☐ | |
| Consulta não duplicada por atendimento | ☐ | |
| Evolução SOAP imutável após criação | ☐ | |
| Prescrição criada em transação atômica | ☐ | |
| Auditoria gravando para ações críticas | ☐ | |
| REVOKE UPDATE/DELETE na tabela auditoria | ☐ | |
| Backup configurado | ☐ | |
| Restauração testada | ☐ | |

---

## 3. Workflow entre Módulos

| Item | Status | Observação |
|------|--------|------------|
| PRESCRIPTION_SENT chega na farmácia | ☐ | |
| WORKFLOW_UPDATED chega na recepção | ☐ | |
| Retry de integração testado | ☐ | |
| Idempotência de eventos testada | ☐ | |
| Fluxo completo: recepção → médico → farmácia | ☐ | |
| Desfechos ALTA/INTERNACAO funcionando | ☐ | |

---

## 4. Backup e Recuperação

| Item | Status | Observação |
|------|--------|------------|
| Backup automático configurado | ☐ | |
| Backup testado em homologação | ☐ | |
| Restauração documentada | ☐ | |
| RPO definido | ☐ | |
| RTO definido | ☐ | |

---

## 5. Observabilidade e Operação

| Item | Status | Observação |
|------|--------|------------|
| Logs estruturados | ☐ | |
| /health respondendo | ☐ | |
| Alertas configurados | ☐ | |
| Runbook disponível | ☐ | |

---

## 6. Testes e Qualidade

| Item | Status | Observação |
|------|--------|------------|
| Testes de smoke passando | ☐ | `npm test` |
| Lint sem erros | ☐ | `npm run lint` |
| Payload inválido retorna 422 | ☐ | |
| Token inválido retorna 401 | ☐ | |
| Papel errado retorna 403 | ☐ | |
| Consulta inexistente retorna 404 | ☐ | |

---

## 7. Compliance / LGPD

| Item | Status | Observação |
|------|--------|------------|
| Dados de prontuário não expostos em logs públicos | ☐ | |
| Base legal para coleta documentada | ☐ | Art. 11 LGPD |
| DPO identificado | ☐ | |
| Política de retenção definida | ☐ | |

---

## 8. Free-first / Custos

| Item | Status | Observação |
|------|--------|------------|
| Ambiente Docker local funcional | ☐ | |
| Limite do tier gratuito documentado | ☐ | |
| Plano de escalonamento definido | ☐ | |

---

## Assinaturas

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Responsável técnico | | | |
| Médico responsável | | | |
| Gestor hospitalar | | | |
