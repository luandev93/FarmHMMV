// ============================================================
// tests/smoke.test.js — Testes de smoke: recepHMMV
// Valida que os endpoints críticos respondem corretamente.
// Não requer banco real: usa mocks do Prisma.
// ============================================================

'use strict';

// Mocka o PrismaClient para não depender de banco em CI
jest.mock('@prisma/client', () => {
  const pacienteMock = {
    id: 'uuid-paciente-1',
    cpf: '52998224725',
    nome: 'João Teste',
    criadoEm: new Date().toISOString(),
  };
  const atendimentoMock = {
    id: 'uuid-atend-1',
    pacienteId: 'uuid-paciente-1',
    tipo: 'CONSULTA',
    queixaPrincipal: 'Dor de cabeça',
    estado: 'AGUARDANDO',
    criadoEm: new Date().toISOString(),
  };
  const filaMock = {
    id: 'uuid-fila-1',
    atendimentoId: 'uuid-atend-1',
    prioridade: 'VERDE',
    nivelNumerico: 4,
    criadoEm: new Date().toISOString(),
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      paciente: {
        upsert:    jest.fn().mockResolvedValue(pacienteMock),
        findUnique: jest.fn().mockResolvedValue(pacienteMock),
      },
      atendimento: {
        create:    jest.fn().mockResolvedValue(atendimentoMock),
        findUnique: jest.fn().mockResolvedValue(atendimentoMock),
        update:    jest.fn().mockResolvedValue({ ...atendimentoMock, estado: 'EM_TRIAGEM' }),
      },
      filaEspera: {
        create:    jest.fn().mockResolvedValue(filaMock),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany:  jest.fn().mockResolvedValue([filaMock]),
        update:    jest.fn().mockResolvedValue({ ...filaMock, saidaEm: new Date() }),
      },
      auditoria: {
        create: jest.fn().mockResolvedValue({ id: 'uuid-audit-1' }),
      },
    })),
  };
});

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../src/app');

// Token de teste com papel de recepção
const TOKEN_RECEPCAO = jwt.sign(
  { sub: 'usuario-1', nome: 'Operador Teste', funcao: 'recepcao', municipioId: 'mun-1' },
  process.env.JWT_SECRET || 'dev-insecure-secret-troque-em-producao',
  { expiresIn: '1h' }
);

describe('GET /health', () => {
  it('deve retornar status 200 e banco ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.banco).toBe('ok');
  });
});

describe('POST /pacientes', () => {
  it('deve criar/atualizar paciente com CPF válido', async () => {
    const res = await request(app)
      .post('/pacientes')
      .set('Authorization', `******
      .send({ cpf: '529.982.247-25', nome: 'João Teste', sexo: 'M' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  it('deve rejeitar CPF inválido com 422', async () => {
    const res = await request(app)
      .post('/pacientes')
      .set('Authorization', `******
      .send({ cpf: '111.111.111-11', nome: 'Inválido' });

    expect(res.status).toBe(422);
  });

  it('deve retornar 401 sem token', async () => {
    const res = await request(app)
      .post('/pacientes')
      .send({ cpf: '529.982.247-25', nome: 'João' });

    expect(res.status).toBe(401);
  });
});

describe('POST /atendimentos', () => {
  it('deve criar atendimento com dados válidos', async () => {
    const res = await request(app)
      .post('/atendimentos')
      .set('Authorization', `******
      .send({
        pacienteId: 'uuid-paciente-1',
        tipo: 'CONSULTA',
        queixaPrincipal: 'Dor de cabeça intensa',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});

describe('POST /fila', () => {
  it('deve enfileirar atendimento com prioridade válida', async () => {
    const res = await request(app)
      .post('/fila')
      .set('Authorization', `******
      .send({
        atendimentoId: 'uuid-atend-1',
        prioridade: 'VERDE',
        queixaTriagem: 'Sem urgência',
      });

    expect(res.status).toBe(200);
    expect(res.body.prioridade).toBe('VERDE');
  });

  it('deve rejeitar prioridade inválida com 422', async () => {
    const res = await request(app)
      .post('/fila')
      .set('Authorization', `******
      .send({ atendimentoId: 'uuid-atend-1', prioridade: 'ROXO' });

    expect(res.status).toBe(422);
  });
});
