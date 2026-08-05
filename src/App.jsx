import { useEffect, useState } from 'react'
import { Carregando, Icone, ProvedorAviso, Vazio } from './components/ui'
import { ProvedorAuth, useAuth } from './lib/auth'
import { ProvedorDados, useDados } from './lib/store'
import { VERSAO, diasParaAniversario, formatarNumero } from './lib/utils'

import Login from './screens/Login'
import Movimentar from './screens/Movimentar'
import Estoque from './screens/Estoque'
import Pedido from './screens/Pedido'
import Inventario from './screens/Inventario'
import Catalogo from './screens/Catalogo'
import Auditoria from './screens/Auditoria'
import Movimentacoes from './screens/Movimentacoes'
import Usuarios from './screens/Usuarios'
import Locais from './screens/Locais'
import Profissionais from './screens/Profissionais'
import Solicitacoes from './screens/Solicitacoes'
import Config from './screens/Config'
import Perfil from './screens/Perfil'

/* Telas: as quatro primeiras ficam na barra inferior; o resto abre pelo menu Mais. */
const TELAS = {
  movimentar: { titulo: 'Movimentar', subtitulo: 'Adicionar, consumir, transferir ou descartar', icone: 'transferencia', comp: Movimentar },
  estoque: { titulo: 'Estoque', subtitulo: 'Saldos, lotes e validades', icone: 'caixa', comp: Estoque },
  pedido: { titulo: 'Pedido', subtitulo: 'Sugestão de reposição', icone: 'pedido', comp: Pedido },
  mais: { titulo: 'Mais', subtitulo: '', icone: 'menu', comp: null },

  inventario: { titulo: 'Inventário', subtitulo: 'Contagem que substitui o saldo', comp: Inventario, exige: 'farmaceutico' },
  catalogo: { titulo: 'Catálogo', subtitulo: 'Itens, categorias e estoque mínimo', comp: Catalogo, exige: 'farmaceutico' },
  solicitacoes: { titulo: 'Pedidos', subtitulo: 'Solicitações da enfermagem', icone: 'solicitacoes', comp: Solicitacoes },
  movimentacoes: { titulo: 'Movimentações', subtitulo: 'Histórico com filtros e exportação', comp: Movimentacoes },
  auditoria: { titulo: 'Auditoria', subtitulo: 'Registro das ações no sistema', comp: Auditoria, exige: 'farmaceutico' },
  locais: { titulo: 'Locais de estoque', subtitulo: 'Regras de cada setor', comp: Locais },
  profissionais: { titulo: 'Profissionais', subtitulo: 'Prescritores, enfermeiros e técnicos', comp: Profissionais },
  usuarios: { titulo: 'Pessoas', subtitulo: 'Acessos, funções e aniversários', comp: Usuarios },
  config: { titulo: 'Configurações', subtitulo: '', comp: Config, exige: 'adm' },
  perfil: { titulo: 'Meu perfil', subtitulo: '', comp: Perfil }
}

const BARRA = ['movimentar', 'estoque', 'pedido', 'solicitacoes', 'mais']

export default function App () {
  return (
    <ProvedorAuth>
      <ProvedorAviso>
        <Roteador />
      </ProvedorAviso>
    </ProvedorAuth>
  )
}

function Roteador () {
  const { usuario, perfil, carregando } = useAuth()

  if (carregando) return <Carregando texto="Entrando…" />
  if (!usuario) return <Login />

  if (!perfil) {
    return <SemPerfil />
  }
  if (perfil.ativo === false) {
    return <AcessoSuspenso />
  }
  if (perfil.funcao === 'enfermagem') {
    return <SomenteEnfermagem />
  }

  return (
    <ProvedorDados>
      <Interface />
    </ProvedorDados>
  )
}

function Interface () {
  const { perfil, sair, ehAdm, ehFarmaceutico } = useAuth()
  const dados = useDados()
  const [tela, setTela] = useState('movimentar')

  useEffect(() => {
    const voltar = () => {
      if (!BARRA.includes(tela)) { setTela('mais'); history.pushState(null, '', '') }
    }
    window.addEventListener('popstate', voltar)
    return () => window.removeEventListener('popstate', voltar)
  }, [tela])

  const podeVer = chave => {
    const exige = TELAS[chave]?.exige
    if (exige === 'adm') return ehAdm
    if (exige === 'farmaceutico') return ehFarmaceutico
    return true
  }

  if (dados.carregando) return <Carregando texto="Carregando o estoque…" />

  const atual = TELAS[tela]
  const Componente = atual?.comp
  const naBarra = BARRA.includes(tela)

  return (
    <div className="app">
      <header className="topo">
        {!naBarra && (
          <button className="voltar" onClick={() => setTela('mais')} aria-label="Voltar">
            <Icone nome="volta" tamanho={20} />
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1>{tela === 'mais' ? (dados.config.nomeUnidade || 'Farmácia') : atual.titulo}</h1>
          {(tela === 'mais' ? perfil.nome : atual.subtitulo) && (
            <div className="sub">{tela === 'mais' ? perfil.nome : atual.subtitulo}</div>
          )}
        </div>
      </header>

      <main className="conteudo">
        {tela === 'mais'
          ? <Mais aoAbrir={setTela} podeVer={podeVer} aoSair={sair} />
          : podeVer(tela)
            ? <Componente />
            : <Vazio titulo="Sem permissão" texto="Esta área é restrita ao seu perfil de acesso." />}
      </main>

      <nav className="nav">
        {BARRA.map(chave => (
          <button
            key={chave}
            aria-current={tela === chave ? 'page' : undefined}
            onClick={() => setTela(chave)}
          >
            <Icone nome={TELAS[chave].icone} />
            {TELAS[chave].titulo}
            {chave === 'solicitacoes' && dados.solicitacoesPendentes > 0 && (
              <span className="marcador">{dados.solicitacoesPendentes}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Mais ({ aoAbrir, podeVer, aoSair }) {
  const { perfil } = useAuth()
  const dados = useDados()

  const aniversariantes = dados.usuarios
    .map(u => ({ ...u, faltam: diasParaAniversario(u.nascimento) }))
    .filter(u => u.faltam !== null && u.faltam <= 7)
    .sort((a, b) => a.faltam - b.faltam)

  const vencidos = dados.vencendo.filter(l => l.dias < 0)

  const opcoes = [
    'movimentacoes', 'inventario', 'catalogo', 'profissionais',
    'auditoria', 'locais', 'usuarios', 'config', 'perfil'
  ]
    .filter(podeVer)

  return (
    <>
      {dados.solicitacoesPendentes > 0 && (
        <button
          className="cartao bloco"
          style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          onClick={() => aoAbrir('solicitacoes')}
        >
          <Icone nome="pedido" tamanho={22} />
          <div style={{ fontSize: 14 }}>
            <b>{dados.solicitacoesPendentes} solicitação(ões) da enfermagem</b>
            <div className="dica">aguardando a farmácia</div>
          </div>
          <Icone nome="seta" tamanho={18} />
        </button>
      )}

      {(dados.abaixoDoMinimo.length > 0 || dados.vencendo.length > 0) && (
        <div className="indicadores bloco">
          <button
            className="indicador alerta"
            style={{ textAlign: 'left', cursor: 'pointer' }}
            onClick={() => aoAbrir('estoque')}
          >
            <div className="n num">{dados.abaixoDoMinimo.length}</div>
            <div className="r">abaixo do mínimo</div>
          </button>
          <button
            className={'indicador ' + (vencidos.length ? 'alerta' : 'atencao')}
            style={{ textAlign: 'left', cursor: 'pointer' }}
            onClick={() => aoAbrir('estoque')}
          >
            <div className="n num">{dados.vencendo.length}</div>
            <div className="r">
              {vencidos.length ? `vencendo · ${vencidos.length} já vencido(s)` : 'lotes vencendo'}
            </div>
          </button>
        </div>
      )}

      {aniversariantes.length > 0 && (
        <div className="cartao bloco" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icone nome="bolo" tamanho={22} />
          <div style={{ fontSize: 14 }}>
            {aniversariantes.map(u => (
              <div key={u.id}>
                <b>{u.nome}</b>{' '}
                {u.faltam === 0 ? 'faz aniversário hoje 🎉' : u.faltam === 1 ? 'faz aniversário amanhã' : `faz aniversário em ${u.faltam} dias`}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="menu-lista bloco">
        {opcoes.map(chave => (
          <button key={chave} className="menu-item" onClick={() => aoAbrir(chave)}>
            <Icone nome={{
              solicitacoes: 'pedido', movimentacoes: 'historico', inventario: 'inventario', catalogo: 'etiqueta',
              profissionais: 'usuarios', auditoria: 'cadeado', locais: 'caixa',
              usuarios: 'usuarios', config: 'engrenagem', perfil: 'pessoa'
            }[chave]} />
            <span>
              {TELAS[chave].titulo}
              {TELAS[chave].subtitulo && <small>{TELAS[chave].subtitulo}</small>}
            </span>
            <Icone nome="seta" tamanho={18} className="seta" />
          </button>
        ))}
      </div>

      <div className="cartao bloco">
        <div className="rotulo">Resumo</div>
        <table className="tabela">
          <tbody>
            <tr><td>Itens no catálogo</td><td className="n">{formatarNumero(dados.itens.length)}</td></tr>
            <tr><td>Locais de estoque</td><td className="n">{formatarNumero(dados.estoques.length)}</td></tr>
            <tr><td>Lotes com saldo</td><td className="n">{formatarNumero(dados.lotes.length)}</td></tr>
            <tr><td>Pessoas com acesso</td><td className="n">{formatarNumero(dados.usuarios.length)}</td></tr>
          </tbody>
        </table>
      </div>

      <button className="btn secundario bloco-largo" onClick={aoSair}>
        <Icone nome="sair" tamanho={18} /> Sair da conta
      </button>

      <p className="dica" style={{ textAlign: 'center', marginTop: 18 }}>
        {perfil.nome} · {perfil.email}
        <br />
        versão {VERSAO}
      </p>
    </>
  )
}

function SomenteEnfermagem () {
  const { sair, perfil } = useAuth()
  return (
    <div className="conteudo" style={{ paddingTop: 60 }}>
      <Vazio
        titulo="Use o app de plantão"
        texto={`${perfil.nome}, seu acesso serve para solicitar medicamentos pelo sistema de relatório da enfermagem. As solicitações chegam à farmácia por lá.`}
        acao={<button className="btn secundario" onClick={sair}>Sair</button>}
      />
    </div>
  )
}

function SemPerfil () {
  const { sair, usuario } = useAuth()
  return (
    <div className="conteudo" style={{ paddingTop: 60 }}>
      <Vazio
        titulo="Conta ainda sem permissão"
        texto={`A conta ${usuario.email} não tem acesso liberado ao estoque. O cadastro é feito pelo administrador — procure a farmácia.`}
        acao={<button className="btn secundario" onClick={sair}>Sair</button>}
      />
    </div>
  )
}

function AcessoSuspenso () {
  const { sair, perfil } = useAuth()
  return (
    <div className="conteudo" style={{ paddingTop: 60 }}>
      <Vazio
        titulo="Acesso suspenso"
        texto={`${perfil.nome}, seu acesso está desativado no momento. Fale com o administrador para reativar.`}
        acao={<button className="btn secundario" onClick={sair}>Sair</button>}
      />
    </div>
  )
}
