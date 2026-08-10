// ============================================================
// tests/smoke.test.js — Testes de smoke: medHMMV
// Valida que os endpoints críticos respondem corretamente.
// ============================================================

'use strict';

jest.mock('@prisma/client', () => {
  const consultaMock = {
    id: 'uuid-consulta-1',
    atendimentoId: 'uuid-atend-1',
    medicoId: 'uuid-medico-1',
    estado: 'EM_ANDAMENTO',
    iniciadaEm: new Date().toISOString(),
  };
  const prescricaoMock = {
    id: 'uuid-presc-1',
    consultaId: 'uuid-consulta-1',
    estado: 'PENDENTE',
    itens: [{ id: 'uuid-item-1', medicamento: 'Dipirona 500mg', dose: '1 comprimido' }],
    criadoEm: new Date().toISOString(),
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      $transaction: jest.fn(fn => fn({
        prescricao: {
          create: jest.fn().mockResolvedValue(prescricaoMock),
        },
        itemPrescricao: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      })),
      consulta: {
        create:    jest.fn().mockResolvedValue(consultaMock),
        findUnique: jest.fn().mockResolvedValue(consultaMock),
        findFirst: jest.fn().mockResolvedValue(null),
        update:    jest.fn().mockResolvedValue({ ...consultaMock, estado: 'FINALIZADA', desfecho: 'ALTA' }),
      },
      evolucao: {
        create: jest.fn().mockResolvedValue({ id: 'uuid-evol-1', consultaId: 'uuid-consulta-1' }),
      },
      prescricao: {
        create:    jest.fn().mockResolvedValue(prescricaoMock),
        findUnique: jest.fn().mockResolvedValue(prescricaoMock),
        update:    jest.fn().mockResolvedValue({ ...prescricaoMock, estado: 'ENVIADA_FARMACIA' }),
      },
      itemPrescricao: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditoria: {
        create: jest.fn().mockResolvedValue({ id: 'uuid-audit-1' }),
      },
    })),
  };
});

// Mock de integração com farmácia (evita chamadas de rede nos testes)
jest.mock('../src/integrations/farmHMMV', () => ({
  enviarPrescricao: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/integrations/recepHMMV', () => ({
  notificarDesfecho: jest.fn().mockResolvedValue(true),
}));

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../src/app');

const TOKEN_MEDICO = jwt.sign(
  { sub: 'uuid-medico-1', nome: 'Dr. Teste', funcao: 'medico', municipioId: 'mun-1' },
  process.env.JWT_SECRET || 'dev-insecure-secret-troque-em-producao',
  { expiresIn: '1h' }
);

describe('GET /health', () => {
  it('deve retornar status 200 e banco ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.servico).toBe('medHMMV');
  });
});

describe('POST /consultas', () => {
  it('deve iniciar consulta com atendimentoId válido', async () => {
    const res = await request(app)
      .post('/consultas')
      .set('Authorization', `******
      .send({ atendimentoId: 'uuid-atend-1' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.estado).toBe('EM_ANDAMENTO');
  });

  it('deve retornar 422 sem atendimentoId', async () => {
    const res = await request(app)
      .post('/consultas')
      .set('Authorization', `******
      .send({});

    expect(res.status).toBe(422);
  });

  it('deve retornar 401 sem token', async () => {
    const res = await request(app).post('/consultas').send({ atendimentoId: 'uuid-atend-1' });
    expect(res.status).toBe(401);
  });
});

describe('POST /consultas/:id/evolucoes', () => {
  it('deve registrar evolução SOAP', async () => {
    const res = await request(app)
      .post('/consultas/uuid-consulta-1/evolucoes')
      .set('Authorization', `******
      .send({ subjetivo: 'Paciente relata dor intensa', avaliacao: 'Cefaleia tensional' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});

describe('POST /prescricoes', () => {
  it('deve criar prescrição com itens válidos', async () => {
    const res = await request(app)
      .post('/prescricoes')
      .set('Authorization', `******
      .send({
        consultaId: 'uuid-consulta-1',
        itens: [{ medicamento: 'Dipirona 500mg', dose: '1 comprimido', frequencia: '6/6h' }],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('deve rejeitar prescrição sem itens', async () => {
    const res = await request(app)
      .post('/prescricoes')
      .set('Authorization', `******
      .send({ consultaId: 'uuid-consulta-1', itens: [] });

    expect(res.status).toBe(422);
  });
});
