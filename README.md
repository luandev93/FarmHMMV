# Controle de estoque · Farmácia — v1.2

Sistema de estoque para farmácia hospitalar, feito para funcionar bem no celular
e também no computador. React + Vite, com Firebase (Authentication + Firestore)
e publicação no Firebase Hosting.

---

## O que o sistema faz

- **Movimentar** — escolhe o local, a ação (adicionar, consumir, transferir ou descartar) e o item.
  Cada lançamento entra numa **lista de rascunho** que pode ser editada ou apagada.
  O estoque só muda quando você toca em **Salvar no estoque**.
- **Busca com sugestão** — a lista aparece já nas primeiras letras, procurando por
  descrição, princípio ativo, código, grupo farmacológico e marca, sem exigir acento.
- **Lote e validade** opcionais na entrada. Na saída e na transferência a baixa é
  automática por **PVPS** (primeiro que vence, primeiro que sai). Lotes sem validade
  são consumidos por último.
- **Consumir** — baixa do saldo do próprio setor, então o histórico mostra quem gastou.
  A cada lançamento escolhe-se entre dispensação a paciente ou consumo interno.
  Paciente, CPF, prescritor e quem administrou são opcionais; prescritor e responsável
  saem do cadastro de profissionais, já com o conselho preenchido.
- **Descartar** — baixa de vencido, danificado, recall, extravio ou devolução ao
  fornecedor. Dá para escolher o lote exato a descartar, em vez do automático.
- **Regras por local** — cada estoque define o que aceita e para onde transfere.
  Um almoxarifado pode ficar só com receber, repassar e descartar, sem dispensar.
- **Inventário** — contagem que **substitui** o saldo, e não soma nem subtrai.
  Restrito a farmacêutico e administrador.
- **Preços** — o sistema valoriza estoque e pedido **apenas pelo preço de contrato**,
  que é o que a unidade paga. O PMVG fica guardado no catálogo só como referência de
  mercado e não entra em nenhum total. Valores aparecem somente para farmacêutico e
  administrador, e não saem no arquivo do pedido.
- **Pedido** — sugestão de reposição combinando estoque mínimo e consumo médio:
  `necessidade = maior valor entre (estoque mínimo) e (consumo diário × dias × margem)`,
  descontando o saldo atual. Exporta CSV e copia a lista pronta.
- **Movimentações** — histórico de todos os lançamentos, com busca por item, pessoa,
  motivo ou lote, e filtros por tipo, local e período. Exporta CSV do que estiver
  filtrado. Aberto a todos os perfis: cada linha mostra quem lançou.
- **Auditoria** — registro das ações feitas no sistema (catálogo, usuários,
  configurações). Restrito a farmacêutico e administrador.
- **Pessoas** — cadastro com função, data de nascimento e lembrete de aniversário,
  troca e recuperação de senha.
- **Catálogo** com 239 itens já classificados (grupo ATC, grupo farmacológico,
  apresentação, unidade, posologia, preço de referência, classe de controle,
  refrigerado e alta vigilância). Todos os saldos começam em zero.

### Quem pode o quê

| Área | Auxiliar | Farmacêutico | Administrador |
|---|---|---|---|
| Movimentar e consultar | sim | sim | sim |
| Sugestão de pedido | sim | sim | sim |
| Ver preços e valor do estoque | não | sim | sim |
| Inventário | não | sim | sim |
| Catálogo de itens | leitura | edição | edição |
| Histórico de movimentações | sim | sim | sim |
| Auditoria do sistema | não | sim | sim |
| Locais de estoque | leitura | leitura | edição |
| Pessoas e configurações | não | não | sim |

---

## 1. Criar o projeto no Firebase

1. Em <https://console.firebase.google.com> crie um projeto.
2. **Criação > Authentication > Sign-in method**: ative **E-mail/senha**.
3. **Criação > Firestore Database**: crie o banco em modo de produção,
   região `southamerica-east1`.
4. **Configurações do projeto > Seus apps > Web (</>)**: registre um app e copie
   o bloco `firebaseConfig`.

## 2. Preparar o código

```bash
cp .env.example .env
```

Preencha o `.env` com os valores do `firebaseConfig`:

```
VITE_FB_API_KEY=...
VITE_FB_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FB_PROJECT_ID=seu-projeto
VITE_FB_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FB_MESSAGING_SENDER_ID=...
VITE_FB_APP_ID=...
```

No `.firebaserc`, troque `SEU-PROJETO-FIREBASE` pelo ID do seu projeto.

## 3. Instalar e rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

## 4. Publicar

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes
npm run deploy   # compila e publica o site
```

As regras e os índices precisam ir **antes** do primeiro uso: sem eles o app
não consegue ler nem gravar, e as telas de pedido e auditoria ficam sem resposta.
Os índices levam um ou dois minutos para ficarem prontos.

## 5. Acessos

Não existe autocadastro. Todo acesso é criado pelo administrador em
**Mais › Pessoas**, com nome, função, data de nascimento e uma senha provisória
que a própria pessoa troca depois em **Meu perfil**. As regras do Firestore
recusam a criação de perfil por qualquer outra via.

O primeiro administrador foi criado na implantação. Se um dia todos os
administradores forem perdidos, a recuperação é manual: criar o documento em
`usuarios/{uid}` com `funcao: "adm"` e `ativo: true` pelo Console do Firebase.

Para fechar também a criação de contas de login no próprio Firebase, vá em
**Authentication > Settings > User actions** e marque *Prevent account creation*.
Atenção: com essa opção ligada, o cadastro pela tela Pessoas para de funcionar,
e as contas passam a ser criadas manualmente no Console.

Sugestão de sequência para começar: ajuste os locais, revise o estoque mínimo dos
itens principais no catálogo e faça o inventário inicial pela tela de Inventário.

---

## Trabalhando pelo Termux

```bash
pkg update && pkg upgrade
pkg install nodejs-lts git openssh
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
cd SEU-REPOSITORIO
npm install
```

Editar, testar e enviar:

```bash
nano src/screens/Movimentar.jsx   # ou vim, ou o editor que preferir
npm run dev                       # confere no navegador do próprio celular
git add -A && git commit -m "ajuste na tela de movimentação"
git push
```

### Publicação automática

O arquivo `.github/workflows/deploy.yml` publica sozinho a cada `git push` na
branch `main` — assim você não precisa rodar o `firebase deploy` pelo celular.
Para ligar, cadastre em **Settings > Secrets and variables > Actions** do
repositório:

- `VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_PROJECT_ID`,
  `VITE_FB_STORAGE_BUCKET`, `VITE_FB_MESSAGING_SENDER_ID`, `VITE_FB_APP_ID`
- `FIREBASE_PROJECT_ID` — o ID do projeto
- `FIREBASE_SERVICE_ACCOUNT` — o JSON gerado por
  `firebase init hosting:github`, ou uma chave de conta de serviço com permissão
  de Firebase Hosting Admin

Se preferir publicar direto do celular:

```bash
npm install -g firebase-tools
firebase login --no-localhost
npm run deploy
```

### Instalar no celular como aplicativo

Abra o endereço no Chrome e escolha **Adicionar à tela inicial**. O app abre em
tela cheia e continua respondendo mesmo com a rede oscilando, porque o Firestore
mantém um cache local — o que for lançado offline sobe assim que a conexão volta.

---

## Como os dados são guardados

| Coleção | Conteúdo |
|---|---|
| `usuarios/{uid}` | nome, e-mail, função, nascimento, telefone, registro, ativo |
| `config/app` | nome da unidade, dias de cobertura, margem, alertas, regras |
| `estoques/{id}` | locais de estoque, com ações e destinos permitidos |
| `profissionais/{id}` | prescritores, enfermeiros e técnicos com conselho e registro |
| `itens/{id}` | catálogo com toda a classificação |
| `saldos/{local__item}` | saldo consolidado, para as listas carregarem rápido |
| `lotes/{local__item__lote__validade}` | saldo por lote, base do PVPS |
| `movimentos/{id}` | histórico imutável de cada lançamento |
| `logs/{id}` | auditoria das ações do sistema |

O histórico de movimentações **não pode ser editado nem apagado** pelo app —
correção se faz com um novo lançamento ou pelo inventário. É o que permite usar
o sistema como registro confiável de medicamentos controlados.

### Campos disponíveis para relatório

Cada movimentação já grava, junto: código e descrição do item, tipo
(medicamento, material, nutrição), grupo ATC, grupo farmacológico, classe de
controle, unidade, local de origem e destino, lote e validade, os lotes de onde
a quantidade saiu, finalidade, paciente e CPF, prescritor e registro, quem
administrou, onde foi usado internamente, motivo, observação, quem lançou e função. Ou seja, dá para
recortar o consumo por classe terapêutica, por setor, por período, por
responsável ou por classe de controle sem precisar cruzar planilhas depois.

---

## Estrutura do código

```
src/
  firebase.js            conexão, cache local, criação de conta sem derrubar a sessão
  lib/
    auth.jsx             sessão, perfil, permissões, mensagens de erro em português
    store.jsx            assinaturas em tempo real e cálculos derivados
    db.js                lançamentos, PVPS, inventário, catálogo, auditoria
    utils.js             formatação, datas, aniversários, CSV, listas fixas
  components/
    ui.jsx               ícones, painéis, avisos, estados de tela
    BuscaItem.jsx        busca com sugestão
  screens/               uma tela por arquivo
  data/catalogo.json     239 itens padronizados
```
