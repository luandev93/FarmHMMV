import { useEffect, useMemo, useRef, useState } from 'react'
import BuscaItem from '../components/BuscaItem'
import { Confirmar, Icone, Painel, Vazio, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import {
  assinarEmprestimos, registrarEmprestimo, quitarEmprestimo, excluirEmprestimo,
  importarEmprestimos, lerCSV
} from '../lib/db'
import {
  SENTIDOS_EMPRESTIMO, SITUACOES_EMPRESTIMO, baixarCSV, dataBR, dataHora,
  formatarNumero, semAcento
} from '../lib/utils'

export default function Emprestimos () {
  const { perfil, usuario, ehFarmaceutico, ehAdm } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [lista, setLista] = useState(null)
  const [sentido, setSentido] = useState('devemos')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(null)
  const [quitando, setQuitando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [erro, setErro] = useState('')
  const arquivo = useRef(null)

  const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.farmacia?.funcao || '' }

  useEffect(() => assinarEmprestimos(setLista, () => {
    setErro('Não foi possível ler os empréstimos. Confirme se as regras foram publicadas.')
    setLista([])
  }), [])

  const filtrados = useMemo(() => {
    const t = semAcento(busca).trim()
    return (lista || [])
      .filter(e => sentido === 'quitados' ? e.situacao === 'quitado' : (e.sentido === sentido && e.situacao !== 'quitado'))
      .filter(e => !t || semAcento(`${e.itemDescricao} ${e.unidade} ${e.itemCodigo}`).includes(t))
  }, [lista, sentido, busca])

  const contar = s => (lista || []).filter(e => e.sentido === s && e.situacao !== 'quitado').length

  function exportar () {
    const l = [['Sentido', 'Unidade', 'Código', 'Item', 'Unidade de medida',
                'Quantidade', 'Quitado', 'Em aberto', 'Situação', 'Registrado em']]
    filtrados.forEach(e => l.push([
      SENTIDOS_EMPRESTIMO[e.sentido], e.unidade, e.itemCodigo, e.itemDescricao, e.itemUnidade,
      e.qtd, e.qtdQuitada || 0, e.qtd - (e.qtdQuitada || 0),
      SITUACOES_EMPRESTIMO[e.situacao], dataHora(e.criadoEm)
    ]))
    baixarCSV(`emprestimos-${new Date().toISOString().slice(0, 10)}.csv`, l)
  }

  if (lista === null) return <p className="dica">Carregando…</p>

  return (
    <>
      {erro && <div className="erro-caixa bloco">{erro}</div>}

      <div className="pilulas">
        <button className="pilula" aria-pressed={sentido === 'devemos'} onClick={() => setSentido('devemos')}>
          Devemos ({contar('devemos')})
        </button>
        <button className="pilula" aria-pressed={sentido === 'devem'} onClick={() => setSentido('devem')}>
          Nos devem ({contar('devem')})
        </button>
        <button className="pilula" aria-pressed={sentido === 'quitados'} onClick={() => setSentido('quitados')}>
          Quitados
        </button>
      </div>

      <div className="bloco">
        <input
          className="campo" type="search" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por item ou unidade"
        />
      </div>

      {ehFarmaceutico && (
        <>
          <div className="acoes bloco">
            <button className="btn" onClick={() => setNovo({ sentido: sentido === 'quitados' ? 'devemos' : sentido })}>
              <Icone nome="entrada" tamanho={18} /> Registrar
            </button>
            <button className="btn secundario" onClick={exportar}>
              <Icone nome="baixar" tamanho={18} /> CSV
            </button>
          </div>

          {ehAdm && (
            <>
              <input
                ref={arquivo} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                onChange={async e => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    setPrevia({ linhas: lerCSV(await f.text()), nome: f.name })
                  } catch (err) {
                    avisar(err.message, 'erro')
                  }
                }}
              />
              <button className="btn secundario bloco-largo bloco" onClick={() => arquivo.current?.click()}>
                <Icone nome="etiqueta" tamanho={18} /> Importar pendências antigas
              </button>
            </>
          )}
        </>
      )}

      {filtrados.length === 0 ? (
        <Vazio
          titulo={sentido === 'quitados' ? 'Nenhum empréstimo quitado' : 'Nada em aberto'}
          texto={
            sentido === 'devem'
              ? 'Quando emprestar algo a outra unidade, registre aqui para não esquecer de cobrar.'
              : 'Empréstimos que o hospital deve devolver aparecem nesta lista.'
          }
        />
      ) : (
        <div className="lista">
          {filtrados.map(e => {
            const resta = e.qtd - (e.qtdQuitada || 0)
            return (
              <div key={e.id} className="cartao" style={{ padding: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 620, lineHeight: 1.3 }}>{e.itemDescricao}</div>
                <div className="meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: 'var(--tinta-fraca)' }}>
                  <span className="etq">{e.unidade}</span>
                  {e.itemCodigo && <span className="etq">{e.itemCodigo}</span>}
                  <span className={'etq ' + (e.situacao === 'aberto' ? 'atencao' : e.situacao === 'quitado' ? 'ok' : '')}>
                    {SITUACOES_EMPRESTIMO[e.situacao]}
                  </span>
                  {e.semVinculo && <span className="etq alerta">item fora do catálogo</span>}
                  {e.cargaInicial && <span className="etq">carga inicial</span>}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 10 }}>
                  <div>
                    <div className="rotulo" style={{ marginBottom: 2 }}>Em aberto</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>
                      {formatarNumero(resta)}
                      <span style={{ fontSize: 12, color: 'var(--tinta-fraca)', fontWeight: 400 }}>
                        {' '}{e.itemUnidade?.toLowerCase()}
                      </span>
                    </div>
                  </div>
                  {e.qtdQuitada > 0 && (
                    <div className="dica">de {formatarNumero(e.qtd)} · {formatarNumero(e.qtdQuitada)} já devolvido</div>
                  )}
                </div>

                {e.observacao && <p className="dica" style={{ marginTop: 6 }}>{e.observacao}</p>}

                {ehFarmaceutico && e.situacao !== 'quitado' && (
                  <div className="acoes" style={{ marginTop: 10 }}>
                    {ehAdm && (
                      <button className="btn secundario pequeno" onClick={() => setExcluindo(e)}>Excluir</button>
                    )}
                    <button className="btn pequeno" onClick={() => setQuitando(e)}>
                      {e.sentido === 'devemos' ? 'Registrar devolução' : 'Recebemos de volta'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {novo && (
        <FormularioEmprestimo
          inicial={novo}
          aoFechar={() => setNovo(null)}
          aoSalvar={async (d, semMovimento) => {
            await registrarEmprestimo(d, ctx, { semMovimento })
            setNovo(null)
            avisar('Empréstimo registrado.', 'ok')
          }}
        />
      )}

      {quitando && (
        <PainelQuitacao
          emprestimo={quitando}
          aoFechar={() => setQuitando(null)}
          aoConfirmar={async (qtd, estoque) => {
            await quitarEmprestimo(quitando, qtd, ctx, {
              estoqueId: estoque?.id, estoqueNome: estoque?.nome
            })
            setQuitando(null)
            avisar('Devolução registrada.', 'ok')
          }}
        />
      )}

      {previa && (
        <Confirmar
          titulo="Importar pendências"
          texto={`${previa.linhas.length - 1} linha(s) em ${previa.nome}. As pendências são criadas sem mexer no saldo — os itens já trocaram de mãos antes do sistema existir.`}
          rotuloConfirmar="Importar"
          aoFechar={() => setPrevia(null)}
          aoConfirmar={async () => {
            try {
              const r = await importarEmprestimos(previa.linhas, dados.itens, ctx)
              avisar(
                `${r.criados} pendência(s) criadas.` +
                (r.semItem.length ? ` ${r.semItem.length} linha(s) ignoradas.` : ''),
                'ok'
              )
            } catch (err) {
              avisar(err.message, 'erro')
            } finally {
              setPrevia(null)
            }
          }}
        />
      )}

      {excluindo && (
        <Confirmar
          titulo="Excluir o registro?"
          texto={`A pendência de ${excluindo.itemDescricao} com ${excluindo.unidade} some da lista. Isso não desfaz movimentação de estoque já feita.`}
          rotuloConfirmar="Excluir"
          perigo
          aoFechar={() => setExcluindo(null)}
          aoConfirmar={async () => {
            await excluirEmprestimo(excluindo, ctx)
            setExcluindo(null)
            avisar('Registro excluído.', 'ok')
          }}
        />
      )}
    </>
  )
}

function FormularioEmprestimo ({ inicial, aoSalvar, aoFechar }) {
  const dados = useDados()
  const [sentido, setSentido] = useState(inicial.sentido)
  const [unidade, setUnidade] = useState('')
  const [estoqueId, setEstoqueId] = useState(dados.estoques[0]?.id || '')
  const [item, setItem] = useState(null)
  const [qtd, setQtd] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [observacao, setObservacao] = useState('')
  const [semMovimento, setSemMovimento] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const estoque = dados.estoques.find(e => e.id === estoqueId)

  return (
    <Painel
      titulo="Registrar empréstimo"
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn secundario" onClick={aoFechar}>Cancelar</button>
          <button
            className="btn" disabled={salvando}
            onClick={async () => {
              setErro('')
              if (!item) return setErro('Escolha o item.')
              if (!unidade.trim()) return setErro('Informe a unidade.')
              setSalvando(true)
              try {
                await aoSalvar({
                  sentido, unidade, estoqueId, estoqueNome: estoque?.nome,
                  itemId: item.id, itemCodigo: item.codigo, itemDescricao: item.descricao,
                  itemUnidade: item.unidade, itemTipo: item.tipo, itemControlado: item.controlado,
                  qtd, dataPrevista, observacao
                }, semMovimento)
              } catch (e) {
                setErro(e.message)
              } finally {
                setSalvando(false)
              }
            }}
          >{salvando ? 'Salvando…' : 'Registrar'}</button>
        </>
      }
    >
      <div className="campos">
        <div>
          <label className="rotulo">Sentido</label>
          <div className="acao-grupo" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {Object.entries(SENTIDOS_EMPRESTIMO).map(([id, nome]) => (
              <button
                key={id} className="acao-btn consumo" aria-pressed={sentido === id}
                onClick={() => setSentido(id)} style={{ minHeight: 52 }}
              >{nome}</button>
            ))}
          </div>
          <p className="dica" style={{ marginTop: 6 }}>
            {sentido === 'devemos'
              ? 'Pegamos emprestado: o item entra no nosso saldo e fica a devolver.'
              : 'Emprestamos: o item sai do saldo e fica a receber.'}
          </p>
        </div>

        <div>
          <label className="rotulo">Unidade</label>
          <input
            className="campo" value={unidade} onChange={e => setUnidade(e.target.value)}
            placeholder="Nome do hospital ou unidade" autoCapitalize="words"
          />
        </div>

        <div>
          <label className="rotulo">Local do estoque</label>
          <select className="campo" value={estoqueId} onChange={e => setEstoqueId(e.target.value)}>
            {dados.estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>

        <div>
          <label className="rotulo">Item</label>
          <BuscaItem
            estoqueId={estoqueId} escolhido={item}
            aoEscolher={setItem} aoLimpar={() => setItem(null)}
          />
        </div>

        {item && (
          <div>
            <label className="rotulo">Quantidade em {item.unidade?.toLowerCase()}</label>
            <input
              className="campo num" inputMode="decimal" value={qtd}
              onChange={e => setQtd(e.target.value.replace(/[^\d.,]/g, ''))}
            />
          </div>
        )}

        <div>
          <label className="rotulo">Devolução prevista</label>
          <input
            className="campo" type="date" value={dataPrevista}
            onChange={e => setDataPrevista(e.target.value)}
          />
        </div>

        <div>
          <label className="rotulo">Observação</label>
          <input className="campo" value={observacao} onChange={e => setObservacao(e.target.value)} />
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5 }}>
          <input
            type="checkbox" checked={semMovimento} onChange={e => setSemMovimento(e.target.checked)}
            style={{ width: 22, height: 22, accentColor: 'var(--azul-600)', flex: 'none' }}
          />
          <span>
            Já aconteceu antes do sistema
            <small style={{ display: 'block', color: 'var(--tinta-fraca)', fontSize: 12.5, marginTop: 2 }}>
              Cria só a pendência, sem mexer no saldo. Use para registrar dívidas antigas.
            </small>
          </span>
        </label>

        {erro && <div className="erro-caixa">{erro}</div>}
      </div>
    </Painel>
  )
}

function PainelQuitacao ({ emprestimo, aoConfirmar, aoFechar }) {
  const dados = useDados()
  const resta = emprestimo.qtd - (emprestimo.qtdQuitada || 0)
  const [qtd, setQtd] = useState(String(resta))
  const [estoqueId, setEstoqueId] = useState(emprestimo.estoqueId || dados.estoques[0]?.id || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const estoque = dados.estoques.find(e => e.id === estoqueId)

  return (
    <Painel
      titulo={emprestimo.sentido === 'devemos' ? 'Registrar devolução' : 'Recebemos de volta'}
      descricao={`${emprestimo.itemDescricao} · ${emprestimo.unidade}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn secundario" onClick={aoFechar}>Cancelar</button>
          <button
            className="btn" disabled={salvando}
            onClick={async () => {
              setSalvando(true)
              setErro('')
              try { await aoConfirmar(Number(qtd), estoque) }
              catch (e) { setErro(e.message) }
              finally { setSalvando(false) }
            }}
          >{salvando ? 'Gravando…' : 'Confirmar'}</button>
        </>
      }
    >
      <div className="campos">
        <div className="info-caixa">
          {emprestimo.sentido === 'devemos'
            ? 'O item sai do nosso estoque e volta para a unidade credora.'
            : 'O item volta para o nosso estoque.'}
        </div>

        <div>
          <label className="rotulo">Quantidade (restam {formatarNumero(resta)})</label>
          <input
            className="campo num" inputMode="decimal" value={qtd}
            onChange={e => setQtd(e.target.value.replace(/[^\d.,]/g, ''))}
          />
        </div>

        <div>
          <label className="rotulo">Local do estoque</label>
          <select className="campo" value={estoqueId} onChange={e => setEstoqueId(e.target.value)}>
            {dados.estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>

        {erro && <div className="erro-caixa">{erro}</div>}
      </div>
    </Painel>
  )
}
