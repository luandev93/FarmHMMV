import { useEffect, useMemo, useState } from 'react'
import { Icone, Painel, Vazio, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { assinarSolicitacoes, atenderSolicitacao, recusarSolicitacao } from '../lib/db'
import {
  MOTIVOS_RECUSA, SITUACOES_SOLICITACAO, dataHora, formatarNumero
} from '../lib/utils'

export default function Solicitacoes () {
  const { perfil, usuario } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [lista, setLista] = useState(null)
  const [situacao, setSituacao] = useState('pendente')
  const [aberta, setAberta] = useState(null)
  const [erro, setErro] = useState('')

  const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.farmacia?.funcao || '' }
  const dispensacao = dados.estoques.find(e => e.id === dados.config.estoqueDispensacaoId)

  useEffect(() => {
    const parar = assinarSolicitacoes(setLista, () => {
      setErro('Não foi possível ler as solicitações. Confirme se as regras da v1.4 foram publicadas.')
      setLista([])
    })
    return parar
  }, [])

  const filtradas = useMemo(
    () => (lista || []).filter(s => !situacao || s.status === situacao),
    [lista, situacao]
  )

  const pendentes = (lista || []).filter(s => s.status === 'pendente').length

  if (lista === null) return <p className="dica">Carregando solicitações…</p>

  return (
    <>
      {!dispensacao && (
        <div className="aviso-caixa bloco">
          Nenhuma farmácia de dispensação definida. Vá em <b>Configurações</b> e escolha de qual
          local sai a baixa quando uma solicitação for atendida.
        </div>
      )}
      {erro && <div className="erro-caixa bloco">{erro}</div>}

      <div className="pilulas">
        <button className="pilula" aria-pressed={situacao === 'pendente'} onClick={() => setSituacao('pendente')}>
          Pendentes{pendentes ? ` (${pendentes})` : ''}
        </button>
        <button className="pilula" aria-pressed={situacao === ''} onClick={() => setSituacao('')}>Todas</button>
        {Object.entries(SITUACOES_SOLICITACAO)
          .filter(([id]) => id !== 'pendente')
          .map(([id, nome]) => (
            <button key={id} className="pilula" aria-pressed={situacao === id} onClick={() => setSituacao(id)}>
              {nome}
            </button>
          ))}
      </div>

      {filtradas.length === 0 ? (
        <Vazio
          titulo={situacao === 'pendente' ? 'Nenhuma solicitação esperando' : 'Nada nesta situação'}
          texto="Os pedidos enviados pelo app de plantão da enfermagem aparecem aqui."
        />
      ) : (
        <div className="lista">
          {filtradas.map(s => {
            const itens = s.linhas?.length || 0
            const temControlado = s.linhas?.some(l => l.controlado)
            return (
              <button key={s.id} className="linha-item" onClick={() => setAberta(s)}>
                <div className="corpo">
                  <div className="nome">
                    {s.setor || 'Setor não informado'}
                    {s.pacienteNome ? ` · ${s.pacienteNome}` : ''}
                  </div>
                  <div className="meta">
                    <span className={'etq ' + (s.status === 'pendente' ? 'atencao' : s.status === 'recusada' ? 'alerta' : 'ok')}>
                      {SITUACOES_SOLICITACAO[s.status] || s.status}
                    </span>
                    <span className="etq">
                      {s.paraConsumo === false ? 'reposição' : 'consumo'}
                    </span>
                    <span>{itens} item(ns)</span>
                    {temControlado && <span className="etq controle">controlado</span>}
                    <span>{dataHora(s.criadoEm)}</span>
                    {s.solicitanteNome && <span>{s.solicitanteNome}</span>}
                  </div>
                </div>
                <Icone nome="seta" tamanho={18} />
              </button>
            )
          })}
        </div>
      )}

      {aberta && (
        <DetalheSolicitacao
          solicitacao={aberta}
          dispensacao={dispensacao}
          aoFechar={() => setAberta(null)}
          aoAtender={async (linhas, observacao) => {
            const n = await atenderSolicitacao(aberta, linhas, ctx, {
              estoqueId: dispensacao?.id,
              estoqueNome: dispensacao?.nome,
              permitirNegativo: dados.config.permitirSaldoNegativo,
              observacao
            })
            setAberta(null)
            avisar(`${n} item(ns) liberados e baixados do estoque.`, 'ok')
          }}
          aoRecusar={async motivo => {
            await recusarSolicitacao(aberta, motivo, ctx)
            setAberta(null)
            avisar('Solicitação recusada.', 'ok')
          }}
        />
      )}
    </>
  )
}

function DetalheSolicitacao ({ solicitacao, dispensacao, aoAtender, aoRecusar, aoFechar }) {
  const dados = useDados()
  const [linhas, setLinhas] = useState(
    (solicitacao.linhas || []).map(l => ({
      ...l,
      // A solicitação chega com zero; o padrão é liberar tudo o que foi pedido.
      qtdAtendida: l.qtdAtendida || l.qtdSolicitada
    }))
  )
  const [observacao, setObservacao] = useState('')
  const [recusando, setRecusando] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const decidida = solicitacao.status !== 'pendente'

  const trocar = (i, valor) => setLinhas(a =>
    a.map((l, k) => (k === i ? { ...l, qtdAtendida: valor.replace(/[^\d]/g, '') } : l))
  )

  const saldoDe = itemId => (dispensacao ? dados.saldoDe(dispensacao.id, itemId) : 0)

  async function executar (acao) {
    setOcupado(true)
    setErro('')
    try { await acao() } catch (e) { setErro(e.message) } finally { setOcupado(false) }
  }

  return (
    <Painel
      titulo={solicitacao.setor || 'Solicitação'}
      descricao={`${dataHora(solicitacao.criadoEm)} · ${solicitacao.solicitanteNome || 'sem identificação'}`}
      aoFechar={aoFechar}
      rodape={decidida ? (
        <button className="btn secundario" onClick={aoFechar}>Fechar</button>
      ) : recusando ? (
        <>
          <button className="btn secundario" onClick={() => setRecusando(false)}>Voltar</button>
          <button
            className="btn perigo" disabled={ocupado || !motivoRecusa}
            onClick={() => executar(() => aoRecusar(motivoRecusa))}
          >{ocupado ? 'Enviando…' : 'Confirmar recusa'}</button>
        </>
      ) : (
        <>
          <button className="btn secundario perigo" onClick={() => setRecusando(true)}>Recusar</button>
          <button
            className="btn" disabled={ocupado || !dispensacao}
            title={dispensacao ? '' : 'Defina a farmácia de dispensação em Configurações'}
            onClick={() => executar(() => aoAtender(linhas, observacao))}
          >{ocupado
              ? 'Gravando…'
              : solicitacao.paraConsumo === false ? 'Atender e transferir' : 'Atender e baixar'}</button>
        </>
      )}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        <span className={'etq ' + (solicitacao.status === 'pendente' ? 'atencao' : solicitacao.status === 'recusada' ? 'alerta' : 'ok')}>
          {SITUACOES_SOLICITACAO[solicitacao.status] || solicitacao.status}
        </span>
        {solicitacao.solicitanteConselho && <span className="etq">{solicitacao.solicitanteConselho}</span>}
      </div>

      {(solicitacao.pacienteNome || solicitacao.prescritorNome || solicitacao.motivo) && (
        <dl style={{ margin: '16px 0 0', display: 'grid', gap: 10 }}>
          {solicitacao.pacienteNome && (
            <div>
              <dt className="rotulo" style={{ marginBottom: 2 }}>Paciente</dt>
              <dd style={{ margin: 0, fontSize: 14 }}>
                {solicitacao.pacienteNome}
                {solicitacao.pacienteCPF ? ` · ${solicitacao.pacienteCPF}` : ''}
              </dd>
            </div>
          )}
          {solicitacao.prescritorNome && (
            <div>
              <dt className="rotulo" style={{ marginBottom: 2 }}>Prescritor</dt>
              <dd style={{ margin: 0, fontSize: 14 }}>
                {solicitacao.prescritorNome} {solicitacao.prescritorConselho || ''}
              </dd>
            </div>
          )}
          {solicitacao.motivo && (
            <div>
              <dt className="rotulo" style={{ marginBottom: 2 }}>Motivo</dt>
              <dd style={{ margin: 0, fontSize: 14 }}>{solicitacao.motivo}</dd>
            </div>
          )}
          {solicitacao.observacao && (
            <div>
              <dt className="rotulo" style={{ marginBottom: 2 }}>Observação da enfermagem</dt>
              <dd style={{ margin: 0, fontSize: 14 }}>{solicitacao.observacao}</dd>
            </div>
          )}
        </dl>
      )}

      {solicitacao.paraConsumo === false && (
        <div className="info-caixa" style={{ marginTop: 16 }}>
          Pedido de <b>reposição</b>: ao liberar, os itens são transferidos para o estoque
          de {solicitacao.setor}, e a baixa acontece lá quando forem usados.
        </div>
      )}

      <h3 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>
        Itens pedidos {!decidida && <span className="dica">— ajuste para menos se precisar</span>}
      </h3>

      <div className="lista">
        {linhas.map((l, i) => {
          const saldo = saldoDe(l.itemId)
          const pedido = Number(l.qtdSolicitada) || 0
          const liberar = Number(l.qtdAtendida) || 0
          return (
            <div key={l.itemId + i} className="cartao" style={{ padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 620, lineHeight: 1.3 }}>{l.descricao}</div>
              <div className="meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: 'var(--tinta-fraca)' }}>
                <span className="etq">{l.codigo}</span>
                <span>pediu {formatarNumero(pedido)} {l.unidade?.toLowerCase()}</span>
                {dispensacao && (
                  <span className={'etq ' + (saldo < liberar ? 'alerta' : '')}>
                    saldo {formatarNumero(saldo)}
                  </span>
                )}
                {l.controlado && <span className="etq controle">{l.controlado}</span>}
              </div>

              {decidida ? (
                <p className="dica" style={{ marginTop: 8 }}>
                  Liberado: <b>{formatarNumero(l.qtdAtendida || 0)}</b>
                </p>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <label className="rotulo" style={{ margin: 0 }}>Liberar</label>
                  <input
                    className="campo num" style={{ maxWidth: 110, minHeight: 44 }}
                    inputMode="numeric" value={l.qtdAtendida}
                    onChange={e => trocar(i, e.target.value)}
                  />
                  <span className="dica">{l.unidade?.toLowerCase()}</span>
                  {liberar > pedido && (
                    <span className="etq alerta">acima do pedido</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!decidida && !dispensacao && (
        <div className="aviso-caixa" style={{ marginTop: 16 }}>
          Para liberar, primeiro escolha a <b>farmácia de dispensação</b> em
          Mais › Configurações. É de lá que a baixa vai sair.
        </div>
      )}

      {!decidida && !recusando && (
        <div style={{ marginTop: 16 }}>
          <label className="rotulo" htmlFor="obsfarm">Observação da farmácia</label>
          <input
            id="obsfarm" className="campo" value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Fica registrado no histórico da movimentação"
          />
        </div>
      )}

      {recusando && (
        <div style={{ marginTop: 16 }}>
          <label className="rotulo" htmlFor="mrec">Motivo da recusa</label>
          <select id="mrec" className="campo" value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)}>
            <option value="">Escolha…</option>
            {MOTIVOS_RECUSA.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      {decidida && (
        <p className="dica" style={{ marginTop: 16 }}>
          Decidida por {solicitacao.decididoPorNome} em {dataHora(solicitacao.decididoEm)}
          {solicitacao.motivoRecusa ? ` · ${solicitacao.motivoRecusa}` : ''}
        </p>
      )}

      {erro && <div className="erro-caixa" style={{ marginTop: 14 }}>{erro}</div>}
    </Painel>
  )
}
