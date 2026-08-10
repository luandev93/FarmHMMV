# medHMMV — Módulo Médico

> **SaaS Workflow ERP Healthcare · HMMV**  
> Versão: 1.0.0-bootstrap · Node.js ≥ 18 · PostgreSQL 15+

Módulo backend responsável pelo fluxo clínico médico: início e finalização
de consultas, registro de evolução SOAP, criação de prescrições e envio
para a farmácia, além da atualização de estado de workflow (alta/internação).

---

## Estrutura do projeto

```
src/
  app.js                    Ponto de entrada (Express + middlewares globais)
  routes/
    health.js               GET /health (público)
    consultas.js            POST /consultas, PATCH /consultas/:id/finalizar,
                            POST /consultas/:id/evolucoes
    prescricoes.js          POST /prescricoes
    eventos.js              POST /eventos (receptor de integração)
  services/
    consultaService.js      Início, finalização, evolução SOAP
    prescricaoService.js    Criação de prescrição + envio farmácia
    auditService.js         Log imutável de auditoria
  middleware/
    auth.js                 Autenticação JWT
    rbac.js                 RBAC por função
    validate.js             Validação via Zod
    correlationId.js        Rastreamento de requisições
  integrations/
    farmHMMV.js             Envia prescrições para farmácia (retry/backoff)
    recepHMMV.js            Notifica recepção sobre desfechos
prisma/
  schema.prisma             Modelo de dados
  migrations/               Migrações SQL não-destrutivas
docs/
  HOMOLOGACAO.md
  GO-LIVE.md
  RUNBOOK-BACKUP-RESTORE.md
tests/
  smoke.test.js
```

---

## Início rápido (ambiente local)

### Com Docker (recomendado)

```bash
docker compose up -d
docker compose exec medico npm run prisma:migrate
curl http://localhost:3002/health
```

### Sem Docker

```bash
npm install
cp .env.example .env
# Edite .env com credenciais reais
npm run prisma:migrate
npm run prisma:generate
npm run dev
```

---

## Scripts disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Desenvolvimento com hot-reload |
| `npm start` | Produção |
| `npm run lint` | ESLint |
| `npm test` | Testes de smoke |
| `npm run prisma:migrate` | Aplica migrações |
| `npm run prisma:generate` | Regenera cliente Prisma |
| `npm run prisma:studio` | Interface visual do banco |

---

## Endpoints

### Público
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do serviço |

### Autenticado (JWT Bearer)

| Método | Rota | Papéis | Descrição |
|--------|------|--------|-----------|
| POST | `/consultas` | medico, adm | Iniciar consulta |
| PATCH | `/consultas/:id/finalizar` | medico, adm | Finalizar com desfecho |
| POST | `/consultas/:id/evolucoes` | medico, adm | Registrar evolução SOAP |
| POST | `/prescricoes` | medico, adm | Criar prescrição |

### Integração (API Key)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/eventos` | Receber eventos de outros módulos |

---

## Contrato de eventos

### Eventos recebidos (receptor `/eventos`)

| Evento | Origem | Descrição |
|--------|--------|-----------|
| `PATIENT_TRANSFERRED` | recepHMMV | Paciente encaminhado para o médico |
| `PRESCRIPTION_DISPENSED` | farmHMMV | Prescrição dispensada |

### Eventos enviados

| Evento | Destino | Descrição |
|--------|---------|-----------|
| `PRESCRIPTION_SENT` | farmHMMV | Prescrição enviada para dispensação |
| `WORKFLOW_UPDATED` | recepHMMV | Desfecho do atendimento |

---

## Desfechos disponíveis

| Desfecho | Descrição |
|----------|-----------|
| `ALTA` | Paciente liberado |
| `INTERNACAO` | Paciente internado |
| `RETORNO` | Agendamento de retorno |
| `ENCAMINHAMENTO` | Encaminhado para especialidade |

---

## Segurança

- **JWT**: todos os endpoints (exceto `/health` e `/eventos`) exigem token.
- **API Key** (`X-Api-Key`): endpoint `/eventos` usa autenticação inter-serviços.
- **RBAC**: papel `medico` para ações clínicas; `adm` para gestão.
- **Auditoria imutável**: toda ação crítica é registrada.
- **Retry com backoff**: integrações com farmácia e recepção toleram falhas transitórias.

---

## Operação free-first

| Componente | Custo local | Custo em cloud |
|------------|-------------|----------------|
| PostgreSQL | Gratuito (Docker) | Supabase free tier (500 MB) |
| Redis | Gratuito (Docker) | Redis Cloud free tier |
| Node.js app | Gratuito | Railway / Render free tier |

---

## Adequações Futuras

### Multi-município
- Campo `municipioId` já previsto no payload JWT.
- Row-Level Security no Postgres para isolamento por tenant.

### Expansão clínica
- Integração com RNDS (Rede Nacional de Dados em Saúde) / FHIR R4.
- Solicitação de exames laboratoriais e de imagem.
- Assinatura digital de prescrições (ICP-Brasil).
- Telemedicina: vídeo-consulta integrada.

### Hardening adicional
- mTLS entre módulos internos.
- Criptografia de dados sensíveis em repouso.
- Varredura automática de vulnerabilidades no CI (Trivy, Snyk — custo potencial).
- Rotação de segredos (HashiCorp Vault ou AWS Secrets Manager — custo potencial).

### Compliance/LGPD
- Fluxo de esquecimento de dados (Art. 18 LGPD).
- RIPD elaborado com DPO.
- Criptografia de campos de prontuário em repouso.
- Logs de acesso a dados sensíveis em sistema externo.

---

## Contribuição

- Código e comentários em PT-BR.
- Migrações apenas aditivas (ver `prisma/migrations/README.md`).
- Abrir issue antes de modificar contratos de eventos.
