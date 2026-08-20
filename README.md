# FarmHMMV

# HMMV ERP Hospitalar — Módulo de Farmácia

Sistema de gestão de farmácia hospitalar do ecossistema **HMMV ERP**, desenvolvido para controle de medicamentos e materiais hospitalares, estoque, lotes, validade, dispensação, consumo, inventário, rastreabilidade e auditoria.

O `FarmHMMV` é um módulo independente, porém integrado ao restante do ERP Hospitalar HMMV.

Seu objetivo final é participar de um **workflow hospitalar ponta a ponta**, conectando:

```text
RECEPÇÃO
   ↓
PACIENTE / ATENDIMENTO
   ↓
MÉDICO
   ↓
PRESCRIÇÃO
   ↓
FARMÁCIA
   ↓
DISPENSAÇÃO
   ↓
ENFERMAGEM
   ↓
ADMINISTRAÇÃO
   ↓
CONSUMO
   ↓
AUDITORIA
   ↓
INTEROPERABILIDADE SUS
```

---

# 1. Papel do FarmHMMV no HMMV ERP

O HMMV ERP é composto por módulos independentes:

```text
┌───────────────────────────────────────────────┐
│                 HMMV ERP                      │
├───────────────────────────────────────────────┤
│                                               │
│  recepHMMV       Recepção                    │
│  medHMMV         Médico                      │
│  enfHMMV         Enfermagem                  │
│  FarmHMMV        Farmácia                    │
│  integra_SUS     Interoperabilidade SUS      │
│                                               │
└───────────────────────────────────────────────┘
```

O FarmHMMV é responsável pelo ciclo de medicamentos e materiais dentro do hospital.

Ele não deve conhecer diretamente a implementação interna dos demais módulos.

A comunicação deverá ocorrer através de **contratos internos versionados**.

---

# 2. Objetivo

O objetivo do FarmHMMV é fornecer controle operacional e gerencial sobre:

* medicamentos;
* materiais hospitalares;
* estoque;
* lotes;
* validade;
* entradas;
* saídas;
* consumo;
* dispensação;
* devoluções;
* descarte;
* inventário;
* pedidos;
* fornecedores;
* preços;
* usuários;
* setores;
* pacientes;
* auditoria.

O sistema deve garantir que as movimentações possam ser rastreadas desde sua origem até seu destino.

---

# 3. Estado Atual

O FarmHMMV já possui uma base funcional significativa.

Entre as funcionalidades existentes/documentadas estão:

* controle de estoque;
* movimentações;
* entradas;
* saídas;
* consumo;
* consumo por paciente;
* consumo interno;
* descarte;
* inventário;
* controle de lotes;
* validade;
* PVPS;
* pedidos;
* fornecedores;
* preços;
* sugestão de reposição;
* histórico;
* auditoria;
* permissões;
* usuários;
* integração com Firebase;
* catálogo de produtos;
* controles operacionais da farmácia.

O sistema possui uma base funcional voltada à operação real da farmácia hospitalar.

O objetivo deste SDD é evoluir essa base para um **módulo empresarial integrado ao HMMV ERP**.

---

# 4. Princípio Arquitetural

A arquitetura desejada é:

```text
FarmHMMV
    ↓
Contrato Interno HMMV
    ↓
Serviço de Integração
    ↓
integra_SUS_HMMV
    ↓
Mapper
    ↓
FHIR
    ↓
Adapter governamental
    ↓
SUS / RNDS
```

O FarmHMMV **não deverá se comunicar diretamente com a RNDS**.

Isso permite alterar uma integração governamental sem reescrever o núcleo da farmácia.

---

# 5. Controle de Estoque

O estoque deverá ser baseado em movimentações rastreáveis.

Principais operações:

```text
ENTRADA
SAÍDA
DISPENSAÇÃO
DEVOLUÇÃO
TRANSFERÊNCIA
CONSUMO
DESCARTE
PERDA
INVENTÁRIO
AJUSTE
```

Conceitualmente:

```text
Saldo anterior
+
Entradas
-
Saídas
+
Devoluções
+
/-
Ajustes autorizados
=
Saldo atual
```

Toda alteração relevante deverá possuir registro histórico.

---

# 6. Regra Fundamental de Estoque

O saldo não deve ser tratado como um número que qualquer operação possa alterar livremente.

A alteração do estoque deve possuir uma origem operacional.

Exemplo:

```text
Prescrição
    ↓
Dispensação
    ↓
Movimentação
    ↓
Baixa
```

ou:

```text
Nota / Entrada
    ↓
Recebimento
    ↓
Lote
    ↓
Entrada no estoque
```

ou:

```text
Inventário
    ↓
Contagem
    ↓
Divergência
    ↓
Conferência
    ↓
Ajuste autorizado
```

Isso proporciona rastreabilidade.

---

# 7. Lotes e Validade

O sistema deverá controlar os produtos individualmente por lote quando aplicável.

Estrutura conceitual:

```text
Produto
   ↓
Lote
   ↓
Validade
   ↓
Quantidade
   ↓
Movimentações
```

Isso permite:

* identificar lotes;
* acompanhar validade;
* localizar produtos;
* controlar perdas;
* executar inventários;
* rastrear dispensações;
* apoiar recolhimentos;
* identificar produtos próximos do vencimento.

---

# 8. PVPS / FEFO

O sistema utiliza lógica de **PVPS — Primeiro que Vence, Primeiro que Sai**, equivalente ao conceito FEFO.

Objetivo:

```text
Lote A → vence primeiro
Lote B → vence depois

       ↓

priorizar Lote A
```

A aplicação deverá impedir ou alertar sobre a utilização inadequada de lotes quando houver lote elegível com vencimento anterior, salvo operação autorizada.

---

# 9. Consumo

O FarmHMMV deverá distinguir diferentes tipos de consumo.

Exemplos:

```text
CONSUMO POR PACIENTE
CONSUMO POR SETOR
CONSUMO INTERNO
PERDA
DESCARTE
AJUSTE
```

O consumo por paciente deverá possuir vínculo com o atendimento/paciente quando essa informação estiver disponível.

O consumo por setor deverá permitir análise gerencial.

---

# 10. Setores

O sistema deverá suportar o controle por setores hospitalares.

Exemplos:

```text
TRIAGEM
CLÍNICA MÉDICA
PRONTO SOCORRO
DIVERSOS
```

A estrutura deverá permanecer configurável para cada estabelecimento.

O objetivo é permitir:

```text
Produto
   ↓
Movimentação
   ↓
Setor
```

e posteriormente:

```text
Produto
   ↓
Paciente
   ↓
Atendimento
   ↓
Setor
```

---

# 11. Dispensação

A dispensação representa uma operação central do FarmHMMV.

Fluxo esperado:

```text
PRESCRIÇÃO
    ↓
VALIDAÇÃO
    ↓
SEPARAÇÃO
    ↓
CONFERÊNCIA
    ↓
DISPENSAÇÃO
    ↓
BAIXA
    ↓
RASTREABILIDADE
```

Uma dispensação poderá estar vinculada a:

* paciente;
* atendimento;
* internação;
* prescrição;
* medicamento;
* lote;
* quantidade;
* setor;
* profissional solicitante;
* profissional responsável pela dispensação.

---

# 12. Integração com o Módulo Médico

O `medHMMV` será responsável pela prescrição.

O FarmHMMV deverá receber a prescrição através de contrato interno.

Fluxo:

```text
medHMMV
   ↓
Prescrição
   ↓
Contrato HMMV
   ↓
FarmHMMV
   ↓
Validação
   ↓
Dispensação
```

O FarmHMMV não deverá depender da estrutura interna do `medHMMV`.

---

# 13. Integração com Enfermagem

Fluxo hospitalar esperado:

```text
MÉDICO
   ↓
PRESCRIÇÃO
   ↓
FARMÁCIA
   ↓
DISPENSAÇÃO
   ↓
ENFERMAGEM
   ↓
ADMINISTRAÇÃO
```

Quando tecnicamente aplicável, a rastreabilidade deverá relacionar:

```text
Paciente
Medicamento
Prescrição
Dose
Horário
Lote
Dispensação
Administração
Profissional
```

---

# 14. Integração com Recepção

A recepção será responsável pela criação/identificação do paciente e atendimento.

O FarmHMMV não deverá duplicar desnecessariamente o cadastro mestre de pacientes.

Fluxo:

```text
recepHMMV
   ↓
Paciente
   ↓
Atendimento
   ↓
medHMMV
   ↓
Prescrição
   ↓
FarmHMMV
```

O paciente deverá possuir identificador único dentro do ecossistema HMMV.

---

# 15. Cadastro de Produtos

O sistema deverá manter cadastro de:

* medicamentos;
* materiais;
* apresentações;
* unidades;
* fabricantes;
* fornecedores;
* grupos;
* lotes;
* validade;
* localização.

O catálogo atualmente existente deverá ser preservado durante a evolução do sistema.

---

# 16. Fornecedores

O módulo deverá permitir:

* cadastro;
* identificação;
* histórico de fornecimento;
* pedidos;
* preços;
* relacionamento com entradas.

Objetivo futuro:

```text
Fornecedor
   ↓
Pedido
   ↓
Recebimento
   ↓
Lote
   ↓
Estoque
```

---

# 17. Pedidos e Reposição

O FarmHMMV possui mecanismos relacionados a pedidos e sugestão de reposição.

A evolução deverá transformar essa funcionalidade em um processo formal:

```text
Estoque atual
     ↓
Consumo histórico
     ↓
Estoque mínimo
     ↓
Necessidade calculada
     ↓
Sugestão
     ↓
Pedido
     ↓
Aprovação
     ↓
Recebimento
```

O cálculo não deverá alterar estoque diretamente.

---

# 18. Inventário

O inventário deverá funcionar como processo controlado.

```text
ABERTURA
   ↓
CONTAGEM
   ↓
CONFERÊNCIA
   ↓
DIVERGÊNCIA
   ↓
JUSTIFICATIVA
   ↓
APROVAÇÃO
   ↓
AJUSTE
   ↓
AUDITORIA
```

Nenhum ajuste relevante deverá ocorrer sem rastreabilidade.

---

# 19. Descarte

O descarte deverá possuir registro próprio.

Exemplos de motivo:

* vencimento;
* avaria;
* quebra;
* perda;
* contaminação;
* inutilização;
* outro motivo autorizado.

O sistema deverá registrar:

```text
Produto
Lote
Quantidade
Motivo
Data
Usuário
Observação
```

Quando aplicável, deverão ser mantidos registros complementares exigidos pelos procedimentos do estabelecimento.

---

# 20. Devolução

Devoluções deverão ser tratadas como movimentações próprias.

Exemplo:

```text
Dispensação
    ↓
Não utilizado
    ↓
Devolução
    ↓
Conferência
    ↓
Retorno ao estoque
```

A devolução não deverá simplesmente apagar a saída anterior.

Ela deverá gerar um evento reverso rastreável.

---

# 21. Auditoria

Operações críticas deverão possuir auditoria.

Exemplo conceitual:

```json
{
  "module": "FarmHMMV",
  "operation": "DISPENSE",
  "resource": "Medication",
  "userId": "usuario",
  "timestamp": "data/hora",
  "correlationId": "identificador",
  "status": "SUCCESS"
}
```

A auditoria deverá permitir responder:

```text
QUEM?
O QUÊ?
QUANDO?
QUAL REGISTRO?
QUAL LOTE?
QUAL QUANTIDADE?
QUAL ORIGEM?
QUAL DESTINO?
QUAL RESULTADO?
```

Não registrar dados sensíveis desnecessariamente em logs.

---

# 22. Segurança

O sistema deverá evoluir para segurança adequada a ambiente hospitalar.

Requisitos:

* autenticação;
* autorização;
* perfis;
* permissões;
* segregação de funções;
* validação de entrada;
* proteção das rotas;
* logs de segurança;
* auditoria;
* gerenciamento seguro de credenciais;
* tratamento seguro de erros;
* proteção contra alterações indevidas;
* controle de sessão.

Credenciais nunca deverão ser armazenadas diretamente no código.

---

# 23. Firebase

O projeto possui integração/estrutura relacionada ao Firebase.

A utilização de serviços Firebase deverá permanecer compatível com o modelo de segurança definido para o ERP.

Regras abertas ou permissões excessivas não devem ser utilizadas em produção.

O modelo definitivo deverá contemplar:

```text
Autenticação
    ↓
Identidade
    ↓
Perfil
    ↓
Permissão
    ↓
Recurso
    ↓
Auditoria
```

---

# 24. Relatórios

O módulo deverá oferecer relatórios operacionais e gerenciais.

### Estoque

* posição atual;
* estoque por produto;
* estoque por setor;
* estoque por lote;
* estoque mínimo;
* produtos próximos do vencimento.

### Consumo

* consumo diário;
* consumo mensal;
* consumo por setor;
* consumo por paciente;
* consumo por produto.

### Movimentação

* entradas;
* saídas;
* devoluções;
* transferências;
* descartes;
* perdas;
* ajustes.

### Gestão

* inventários;
* divergências;
* pedidos;
* reposição;
* fornecedores;
* preços.

### Auditoria

* usuários;
* operações;
* alterações;
* movimentações críticas.

---

# 25. Contrato de Integração HMMV

A integração entre módulos deverá utilizar contratos estáveis e versionados.

Exemplos conceituais:

```text
POST /api/integration/patient
POST /api/integration/prescription
POST /api/integration/dispensation
POST /api/integration/stock-movement
```

Os endpoints definitivos deverão ser estabelecidos no SDD mestre do HMMV ERP.

Cada requisição deverá possuir, quando aplicável:

```text
correlationId
module
operation
timestamp
user/context
payload
version
```

---

# 26. Integração SUS

O FarmHMMV não deverá implementar diretamente integrações governamentais.

Arquitetura:

```text
FarmHMMV
     ↓
Contrato interno
     ↓
integra_SUS_HMMV
     ↓
Mapper
     ↓
FHIR
     ↓
Adapter governamental
     ↓
SUS / RNDS
```

Isso reduz o acoplamento e permite evolução independente.

---

# 27. Dados e Identidade

O FarmHMMV deverá utilizar identificadores consistentes com o ecossistema HMMV.

Entidades importantes:

```text
Patient
Organization
Practitioner
Encounter
Medication
MedicationRequest
MedicationDispense
MedicationAdministration
StockMovement
Lot
Inventory
```

Nem todas essas entidades precisam existir como recursos FHIR dentro do próprio FarmHMMV.

O módulo deve manter seu domínio operacional independente da representação externa.

---

# 28. MVP — Critérios Funcionais

Para o MVP SaaS ERP Hospitalar, o FarmHMMV deverá contemplar:

## Estoque

* [x] estrutura de estoque existente;
* [x] movimentações existentes;
* [x] controle de validade;
* [x] lotes;
* [x] PVPS;
* [x] inventário;
* [x] consumo;
* [x] descarte;
* [x] histórico.

Evolução necessária:

* [ ] modelo de movimentação transacional;
* [ ] consistência de saldo;
* [ ] prevenção de duplicidade;
* [ ] idempotência;
* [ ] auditoria completa;
* [ ] testes automatizados.

---

## Dispensação

* [ ] dispensação vinculada a prescrição;
* [ ] paciente;
* [ ] atendimento;
* [ ] lote;
* [ ] conferência;
* [ ] baixa;
* [ ] devolução;
* [ ] rastreabilidade ponta a ponta.

---

## Integração

* [ ] contrato com recepHMMV;
* [ ] contrato com medHMMV;
* [ ] contrato com enfHMMV;
* [ ] contrato com integra_SUS_HMMV;
* [ ] versionamento dos contratos;
* [ ] correlation ID;
* [ ] tratamento de falhas.

---

## Segurança

* [ ] autenticação consolidada;
* [ ] autorização;
* [ ] RBAC;
* [ ] segregação de funções;
* [ ] auditoria;
* [ ] gestão de secrets;
* [ ] proteção de APIs;
* [ ] revisão das regras Firebase;
* [ ] testes de segurança.

---

# 29. Workflow Ponta a Ponta

O cenário principal do MVP deverá ser:

```text
1. PACIENTE
      ↓
2. RECEPÇÃO
      ↓
3. ATENDIMENTO
      ↓
4. MÉDICO
      ↓
5. PRESCRIÇÃO
      ↓
6. FARMÁCIA
      ↓
7. VALIDAÇÃO
      ↓
8. SEPARAÇÃO
      ↓
9. DISPENSAÇÃO
      ↓
10. ENFERMAGEM
      ↓
11. ADMINISTRAÇÃO
      ↓
12. CONSUMO
      ↓
13. AUDITORIA
```

O FarmHMMV deve ser capaz de participar desse fluxo sem duplicação desnecessária de dados.

---

# 30. Critério de Aceitação do Módulo

O FarmHMMV será considerado pronto para o MVP quando for possível executar um fluxo completo:

```text
Paciente
   ↓
Atendimento
   ↓
Prescrição
   ↓
Recebimento da prescrição
   ↓
Validação farmacêutica
   ↓
Separação
   ↓
Conferência
   ↓
Dispensação
   ↓
Baixa do lote
   ↓
Enfermagem
   ↓
Administração
   ↓
Registro
   ↓
Auditoria
```

E responder:

```text
Qual paciente?
Qual medicamento?
Qual prescrição?
Qual lote?
Qual quantidade?
Quem dispensou?
Quando?
Para qual setor?
Qual foi a movimentação?
Qual foi o resultado?
```

---

# 31. Roadmap do FarmHMMV

## Fase 1 — Fundação

**Status: parcialmente concluído**

* [x] estrutura inicial;
* [x] controle de estoque;
* [x] movimentações;
* [x] consumo;
* [x] inventário;
* [x] PVPS;
* [x] descarte;
* [x] histórico;
* [x] permissões;
* [x] auditoria existente.

---

## Fase 2 — Consolidação Técnica

**Status: necessário**

* [ ] revisão arquitetural;
* [ ] revisão de segurança;
* [ ] normalização do domínio;
* [ ] transações;
* [ ] idempotência;
* [ ] validações;
* [ ] testes;
* [ ] documentação técnica;
* [ ] contratos internos.

---

## Fase 3 — Workflow Hospitalar

**Status: necessário**

* [ ] paciente;
* [ ] atendimento;
* [ ] prescrição;
* [ ] dispensação;
* [ ] integração com enfermagem;
* [ ] administração;
* [ ] rastreabilidade ponta a ponta.

---

## Fase 4 — Interoperabilidade

**Status: dependente do integra_SUS_HMMV**

* [ ] integração com gateway;
* [ ] mapeamentos;
* [ ] FHIR;
* [ ] auditoria de integração;
* [ ] tratamento de falhas;
* [ ] homologação das integrações aplicáveis.

---

## Fase 5 — SaaS

**Status: futuro MVP comercial**

* [ ] multi-tenant;
* [ ] estabelecimento;
* [ ] isolamento de dados;
* [ ] configuração por hospital;
* [ ] gestão de usuários;
* [ ] RBAC;
* [ ] observabilidade;
* [ ] backup;
* [ ] recuperação;
* [ ] suporte operacional;
* [ ] implantação padronizada.

---

# 32. Definição de Pronto

O FarmHMMV não será considerado concluído apenas porque as telas e operações básicas funcionam.

A definição de pronto é:

```text
FUNCIONAL
+
CONSISTENTE
+
SEGURO
+
AUDITÁVEL
+
RASTREÁVEL
+
TESTÁVEL
+
INTEGRÁVEL
+
MULTIMÓDULO
+
PREPARADO PARA SaaS
```

---

# 33. Relação com os Outros Repositórios

| Repositório        | Responsabilidade                                    |
| ------------------ | --------------------------------------------------- |
| `recepHMMV`        | paciente, recepção, atendimento e internação        |
| `medHMMV`          | atendimento médico e prescrição                     |
| `enfHMMV`          | assistência e administração de medicamentos         |
| `FarmHMMV`         | estoque, dispensação e rastreabilidade farmacêutica |
| `integra_SUS_HMMV` | interoperabilidade e integrações governamentais     |

---

# 34. Arquitetura Final

```text
                         HMMV ERP
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
     recepHMMV          medHMMV          enfHMMV
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                            ▼
                       FarmHMMV
                            │
                            │
                            ▼
                  integra_SUS_HMMV
                            │
                     ┌──────┴──────┐
                     │             │
                    FHIR          APIs
                     │             │
                     └──────┬──────┘
                            │
                            ▼
                    INTEROPERABILIDADE
                         COM SUS
```

---

# 35. Princípios do Projeto

### Não acoplar módulos diretamente

```text
FarmHMMV → RNDS
```

não é permitido.

O correto:

```text
FarmHMMV → integra_SUS_HMMV → RNDS
```

### Não alterar saldo sem evento

Toda alteração relevante deve possuir origem.

### Não apagar histórico operacional

Correções devem gerar novos eventos quando aplicável.

### Não armazenar secrets no código

Credenciais devem permanecer fora do repositório.

### Não confiar apenas na interface

As regras de segurança e negócio devem existir também no backend.

### Não implementar integração governamental por suposição

A documentação oficial vigente deverá ser utilizada quando a integração real for implementada.

---

# 36. Objetivo Final

Transformar o FarmHMMV de um sistema de gestão de farmácia em um **módulo empresarial de farmácia hospitalar integrado ao HMMV ERP**.

O resultado esperado:

```text
                   HMMV ERP
                       │
                       ▼
                FarmHMMV
                       │
       ┌───────────────┼───────────────┐
       │               │               │
    Estoque       Dispensação       Auditoria
       │               │               │
       └───────────────┼───────────────┘
                       │
                       ▼
               Workflow Hospitalar
                       │
                       ▼
             Interoperabilidade SUS
```

---

# Status do Projeto

**DESENVOLVIMENTO ATIVO**

Objetivo:

**MVP SaaS ERP Hospitalar HMMV — arquitetura modular, workflow hospitalar ponta a ponta, segurança, auditoria e interoperabilidade.**

Este README funciona como **especificação funcional de alto nível do FarmHMMV** e deverá ser atualizado conforme os requisitos técnicos e a implementação evoluírem.
