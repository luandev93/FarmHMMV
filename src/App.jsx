import { useEffect, useState } from 'react'
import { Carregando, Icone, ProvedorAviso, Vazio } from './components/ui'
import { ProvedorAuth, useAuth } from './lib/auth'
import { ProvedorDados, useDados } from './lib/store'
import { diasParaAniversario, formatarNumero } from './lib/utils'

import Login from './screens/Login'
import Movimentar from './screens/Movimentar'
import Estoque from './screens/Estoque'
import Pedido from './screens/Pedido'
import Inventario from './screens/Inventario'
import Catalogo from './screens/Catalogo'
import Auditoria from './screens/Auditoria'
import Usuarios from './screens/Usuarios'
import Locais from './screens/Locais'
import Config from './screens/Config'
import Perfil from './screens/Perfil'

/* Telas: as quatro primeiras ficam na barra inferior; o resto abre pelo menu Mais. */
const TELAS = {
  movimentar: { titulo: 'Movimentar', subtitulo: 'Adicionar, retirar ou transferir', icone: 'transferencia', comp: Movimentar },
  estoque: { titulo: 'Estoque', subtitulo: 'Saldos, lotes e validades', icone: 'caixa', comp: Estoque },
  pedido: { titulo: 'Pedido', subtitulo: 'Sugestão de reposição', icone: 'pedido', comp: Pedido },
  mais: { titulo: 'Mais', subtitulo: '', icone: 'menu', comp: null },

  inventario: { titulo: 'Inventário', subtitulo: 'Contagem que substitui o saldo', comp: Inventario, exige: 'farmaceutico' },
  catalogo: { titulo: 'Catálogo', subtitulo: 'Itens, categorias e estoque mínimo', comp: Catalogo, exige: 'farmaceutico' },
  auditoria: { titulo: 'Auditoria', subtitulo: 'Histórico completo do sistema', comp: Auditoria, exige: 'farmaceutico' },
  locais: { titulo: 'Locais de estoque', subtitulo: '', comp: Locais },
  usuarios: { titulo: 'Pessoas', subtitulo: 'Acessos, funções e aniversários', comp: Usuarios },
  config: { titulo: 'Configurações', subtitulo: '', comp: Config, exige: 'adm' },
  perfil: { titulo: 'Meu perfil', subtitulo: '', comp: Perfil }
}

const BARRA = ['movimentar', 'estoque', 'pedido', 'mais']

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

  const opcoes = ['inventario', 'catalogo', 'auditoria', 'locais', 'usuarios', 'config', 'perfil']
    .filter(podeVer)

  return (
    <>
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
              inventario: 'inventario', catalogo: 'etiqueta', auditoria: 'historico',
              locais: 'caixa', usuarios: 'usuarios', config: 'engrenagem', perfil: 'cadeado'
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
      </p>
    </>
  )
}

function SemPerfil () {
  const { sair, usuario } = useAuth()
  return (
    <div className="conteudo" style={{ paddingTop: 60 }}>
      <Vazio
        titulo="Conta ainda sem permissão"
        texto={`A conta ${usuario.email} existe, mas ninguém liberou o acesso ao estoque. Peça ao administrador para cadastrar você em Mais › Pessoas.`}
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
