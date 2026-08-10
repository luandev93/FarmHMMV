# recepHMMV — Módulo de Recepção

> **SaaS Workflow ERP Healthcare · HMMV**  
> Versão: 1.0.0-bootstrap · Node.js ≥ 18 · PostgreSQL 15+

Módulo backend responsável pelo fluxo de entrada do paciente:
cadastro, criação de atendimento, enfileiramento por prioridade
(Manchester simplificado) e transição segura de estado para o módulo médico.

---

## Estrutura do projeto

```
src/
  app.js                    Ponto de entrada (Express + middlewares globais)
  routes/
    health.js               GET /health (público)
    pacientes.js            POST/GET /pacientes
    atendimentos.js         POST /atendimentos, PATCH /atendimentos/:id/estado
    fila.js                 POST/GET/DELETE /fila
  services/
    pacienteService.js      Upsert e busca de pacientes (valida CPF/CNS)
    atendimentoService.js   Criação e transição de estado
    filaService.js          Enfileiramento Manchester
    auditService.js         Log imutável de auditoria
  middleware/
    auth.js                 Autenticação JWT
    rbac.js                 Controle de acesso por função (RBAC)
    validate.js             Validação de payload via Zod
    correlationId.js        Rastreamento de requisições
  integrations/
    medHMMV.js              Cliente HTTP para módulo médico (retry/backoff)
  utils/
    validarCPF.js           Validação oficial de CPF
    validarCNS.js           Validação de Cartão Nacional de Saúde
prisma/
  schema.prisma             Modelo de dados
  migrations/               Migrações SQL não-destrutivas
docs/
  HOMOLOGACAO.md            Checklist de homologação
  GO-LIVE.md                Procedimento de entrada em produção
  RUNBOOK-BACKUP-RESTORE.md Backup e recuperação
tests/
  smoke.test.js             Testes de smoke (sem banco real)
```

---

## Início rápido (ambiente local)

### Pré-requisitos
- Docker e Docker Compose instalados
- Node.js 18+ (para desenvolvimento sem Docker)

### Com Docker (recomendado)

```bash
# Sobe banco Postgres + Redis + serviço
docker compose up -d

# Aguarda banco ficar saudável e aplica migrações
docker compose exec recepcao npm run prisma:migrate

# Verifica saúde
curl http://localhost:3001/health
```

### Sem Docker (desenvolvimento direto)

```bash
# 1. Instala dependências
npm install

# 2. Configura variáveis de ambiente
cp .env.example .env
# Edite .env com as credenciais do banco local

# 3. Aplica migrações
npm run prisma:migrate
npm run prisma:generate

# 4. Inicia em modo desenvolvimento (hot-reload)
npm run dev
```

---

## Scripts disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia com nodemon (hot-reload) |
| `npm start` | Inicia em produção |
| `npm run lint` | Análise estática de código (ESLint) |
| `npm test` | Executa testes de smoke/integração |
| `npm run prisma:migrate` | Aplica migrações pendentes |
| `npm run prisma:generate` | Regenera o cliente Prisma |
| `npm run prisma:studio` | Interface visual do banco |

---

## Endpoints

### Público
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do serviço e banco |

### Autenticado (JWT no header `Authorization: ******`)

| Método | Rota | Papéis | Descrição |
|--------|------|--------|-----------|
| POST | `/pacientes` | recepcao, adm | Criar/atualizar paciente |
| GET | `/pacientes/:id` | todos | Buscar paciente |
| POST | `/atendimentos` | recepcao, adm | Criar atendimento |
| PATCH | `/atendimentos/:id/estado` | recepcao, adm, enf | Transição de estado |
| POST | `/fila` | recepcao, adm, enf | Enfileirar (Manchester) |
| GET | `/fila` | todos | Listar fila atual |
| DELETE | `/fila/:atendimentoId` | recepcao, adm, enf, medico | Remover da fila |

---

## Contrato de eventos

Eventos enviados para o módulo médico via `POST /eventos` (medHMMV):

| Evento | Momento | Payload |
|--------|---------|---------|
| `PATIENT_REGISTERED` | Após upsert de paciente novo | `{ pacienteId, nome }` |
| `PATIENT_TRANSFERRED` | Após transição → TRANSFERIDO | `{ atendimentoId, pacienteId }` |

---

## Segurança

- **JWT**: todos os endpoints (exceto `/health`) exigem token válido.
- **RBAC**: cada rota define as funções autorizadas.
- **Helmet**: cabeçalhos HTTP seguros.
- **Rate limit**: 300 req/15min por IP (ajustável via `RATE_LIMIT_MAX`).
- **CORS**: somente origens definidas em `CORS_ORIGINS`.
- **Auditoria imutável**: tabela `auditoria` sem update/delete para usuários da app.

---

## Variáveis de ambiente

Veja `.env.example` para a lista completa com descrição de cada variável.

---

## Operação free-first

| Componente | Custo local | Custo em cloud |
|------------|-------------|----------------|
| PostgreSQL | Gratuito (Docker) | ~$20-50/mês (managed, ex.: Supabase free tier disponível) |
| Redis | Gratuito (Docker) | ~$10-30/mês (Redis Cloud free tier disponível) |
| Node.js app | Gratuito | Depende do provedor (Railway, Render, Fly.io têm tiers gratuitos) |

**Limites do tier gratuito**: Supabase free: 500 MB storage, 2 GB transferência.
Ao escalar (>10k atendimentos/mês), planejar upgrade para tier pago.

---

## Adequações Futuras

Esta seção documenta melhorias planejadas para quando o sistema crescer.

### Multi-município
- Adicionar campo `municipioId` em todas as tabelas relevantes (já incluído no JWT).
- Implementar isolamento de dados por tenant no Prisma (Row-Level Security no Postgres).
- Adicionar resolução dinâmica do contexto de município via middleware.

### Expansão de funcionalidades
- Integração com sistemas de prontuário eletrônico (RNDS/FHIR R4).
- Notificações em tempo real via WebSocket/SSE (chamada de paciente no painel).
- Agendamento prévio de consultas.
- Integração com balcão de senhas (hardware).

### Hardening adicional
- mTLS entre módulos internos (actualmente usa API key simples).
- Auditoria em sistema externo imutável (ex.: blockchain privado ou serviço de log certificado).
- Varredura automática de vulnerabilidades no CI/CD (Snyk, Trivy).
- Rotação automática de segredos (HashiCorp Vault ou AWS Secrets Manager — custo potencial).
- WAF na borda (Cloudflare free tier cobre casos básicos).

### Compliance/LGPD
- Implementar fluxo de esquecimento de dados (Art. 18 LGPD) com soft-delete e anonimização.
- Relatório de impacto à proteção de dados (RIPD) a ser elaborado com DPO.
- Criptografia de campos sensíveis em repouso (CPF, CNS, nome da mãe).

---

## Contribuição e manutenção

- Código e comentários em PT-BR.
- Seguir os princípios de migrações não-destrutivas (ver `prisma/migrations/README.md`).
- Abrir issue antes de modificar contratos de API ou eventos de integração.
