-- ============================================================
-- Migração inicial: medHMMV
-- Estratégia: apenas ADD, sem DROP. Idempotente via IF NOT EXISTS.
-- ============================================================

-- Tabela de Consultas
CREATE TABLE IF NOT EXISTS consultas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id  TEXT        NOT NULL,
  medico_id       TEXT        NOT NULL,
  estado          TEXT        NOT NULL DEFAULT 'EM_ANDAMENTO',
  desfecho        TEXT,
  observacao      TEXT,
  correlation_id  TEXT,
  iniciada_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalizada_em   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consultas_atendimento ON consultas (atendimento_id);
CREATE INDEX IF NOT EXISTS idx_consultas_medico      ON consultas (medico_id);

-- Tabela de Evoluções SOAP
CREATE TABLE IF NOT EXISTS evolucoes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id UUID        NOT NULL REFERENCES consultas(id),
  subjetivo   TEXT        NOT NULL,
  objetivo    TEXT,
  avaliacao   TEXT,
  plano       TEXT,
  criado_por  TEXT        NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evolucoes_consulta ON evolucoes (consulta_id);

-- Tabela de Prescrições
CREATE TABLE IF NOT EXISTS prescricoes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id     UUID        NOT NULL REFERENCES consultas(id),
  estado          TEXT        NOT NULL DEFAULT 'PENDENTE',
  criado_por      TEXT        NOT NULL,
  correlation_id  TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescricoes_consulta ON prescricoes (consulta_id);

-- Tabela de Itens de Prescrição
CREATE TABLE IF NOT EXISTS itens_prescricao (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescricao_id  UUID NOT NULL REFERENCES prescricoes(id),
  medicamento    TEXT NOT NULL,
  dose           TEXT NOT NULL,
  via            TEXT,
  frequencia     TEXT,
  duracao        TEXT,
  observacao     TEXT
);

-- Tabela de Auditoria (imutável para usuários da aplicação)
CREATE TABLE IF NOT EXISTS auditoria (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  acao            TEXT        NOT NULL,
  entidade        TEXT        NOT NULL,
  entidade_id     TEXT,
  usuario_id      TEXT        NOT NULL,
  funcao          TEXT        NOT NULL,
  payload         TEXT,
  correlation_id  TEXT,
  ip              TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_entidade  ON auditoria (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario   ON auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON auditoria (criado_em);

-- ============================================================
-- SEGURANÇA: revogar UPDATE e DELETE na tabela auditoria
-- REVOKE UPDATE, DELETE ON auditoria FROM app_medico;
-- ============================================================
