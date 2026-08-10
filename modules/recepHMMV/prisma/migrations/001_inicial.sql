-- ============================================================
-- Migração inicial: recepHMMV
-- Estratégia: apenas ADD, sem DROP. Idempotente via IF NOT EXISTS.
-- ============================================================

-- Tabela de Pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf             VARCHAR(11) UNIQUE,
  cns             VARCHAR(15) UNIQUE,
  nome            TEXT        NOT NULL,
  data_nascimento DATE,
  nome_mae        TEXT,
  municipio       TEXT,
  telefone        TEXT,
  email           TEXT,
  sexo            CHAR(1),
  ativo           BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Atendimentos
CREATE TABLE IF NOT EXISTS atendimentos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id      UUID        NOT NULL REFERENCES pacientes(id),
  tipo             TEXT        NOT NULL DEFAULT 'CONSULTA',
  queixa_principal TEXT        NOT NULL,
  estado           TEXT        NOT NULL DEFAULT 'AGUARDANDO',
  criado_por       TEXT        NOT NULL,
  correlation_id   TEXT,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Fila de Espera
CREATE TABLE IF NOT EXISTS fila_espera (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id  UUID        NOT NULL UNIQUE REFERENCES atendimentos(id),
  prioridade      TEXT        NOT NULL,
  nivel_numerico  SMALLINT    NOT NULL,
  queixa_triagem  TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  saida_em        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fila_nivel_criado ON fila_espera (nivel_numerico, criado_em)
  WHERE saida_em IS NULL;

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

CREATE INDEX IF NOT EXISTS idx_auditoria_entidade    ON auditoria (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario     ON auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em   ON auditoria (criado_em);

-- ============================================================
-- SEGURANÇA: revogar UPDATE e DELETE na tabela auditoria
-- para o role da aplicação (substituir 'app_recepcao' pelo role real)
-- ============================================================
-- REVOKE UPDATE, DELETE ON auditoria FROM app_recepcao;
-- (descomentar e executar manualmente após criar o role no banco)
