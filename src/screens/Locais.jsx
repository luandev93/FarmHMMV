import { useMemo, useState } from 'react'
import { Confirmar, Icone, Painel, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarEstoque, excluirEstoque, salvarItensPadrao } from '../lib/db'
import { ACOES_ESTOQUE, ACOES_PADRAO, TIPOS_ITEM, formatarNumero, semAcento } from '../lib/utils'

export default function Locais () {
  const { perfil, usuario, ehAdm } = useAuth()
  const dados = useDados()
  const avisar = useAviso()
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [padrao, setPadrao] = useState(null)

  const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.funcao }

  const itensNoLocal = id =>
    dados.lotes.filter(l => l.estoqueId === id && l.qtd > 0).length

  return (
    <>
      <p className="dica bloco">
        Cada local é um estoque próprio. Aqui você define o que cada um aceita — um
        almoxarifado, por exemplo, pode só receber, repassar e baixar vencidos, sem
        dispensar a paciente.
      </p>

      {ehAdm && (
        <button
          className="btn bloco-largo bloco"
          onClick={() => setEditando({
            nome: '', descricao: '', ordem: dados.todosEstoques.length + 1,
            ativo: true, acoes: [...ACOES_PADRAO], destinos: []
          })}
        >
          <Icone nome="entrada" tamanho={18} /> Novo local
        </button>
      )}

      <div className="lista">
        {dados.todosEstoques.map(e => (
          <button
            key={e.id} className="linha-item"
            onClick={() => ehAdm && setEditando(e)}
            style={{ cursor: ehAdm ? 'pointer' : 'default' }}
          >
            <div className="corpo">
              <div className="nome" style={{ opacity: e.ativo === false ? .5 : 1 }}>{e.nome}</div>
              <div className="meta">
                {e.descricao && <span>{e.descricao}</span>}
                {e.ativo === false && <span className="etq alerta">desativado</span>}
                {e.requisicaoEnfermagem && <span className="etq ok">requisição da enfermagem</span>}
                {Object.keys(e.itensPadrao || {}).length > 0 && (
                  <span className="etq">{Object.keys(e.itensPadrao).length} itens padrão</span>
                )}
                {Array.isArray(e.acoes) && e.acoes.length > 0 && e.acoes.length < 4 && (
                  <span className="etq">
                    {e.acoes.map(a => ACOES_ESTOQUE[a]).filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
            <div className="valor">
              <div className="n num">{formatarNumero(itensNoLocal(e.id))}</div>
              <div className="u">itens</div>
            </div>
          </button>
        ))}
      </div>

      {editando && (
        <FormularioLocal
          local={editando}
          aoFechar={() => setEditando(null)}
          aoExcluir={() => { setExcluindo(editando); setEditando(null) }}
          aoAbrirPadrao={() => { setPadrao(editando); setEditando(null) }}
          aoSalvar={async d => {
            await salvarEstoque(d, ctx, editando.id || null)
            setEditando(null)
            avisar('Local salvo.', 'ok')
          }}
        />
      )}

      {padrao && (
        <PainelItensPadrao
          local={dados.todosEstoques.find(e => e.id === padrao.id) || padrao}
          ctx={ctx}
          aoAvisar={avisar}
          aoFechar={() => setPadrao(null)}
        />
      )}

      {excluindo && (
        <Confirmar
          titulo="Excluir o local?"
          texto={`"${excluindo.nome}" some da lista. Locais com saldo não podem ser excluídos — transfira os itens antes, ou apenas desative.`}
          rotuloConfirmar="Excluir"
          perigo
          aoFechar={() => setExcluindo(null)}
          aoConfirmar={async () => {
            try {
              await excluirEstoque(excluindo, ctx)
              avisar('Local excluído.', 'ok')
            } catch (err) {
              avisar(err.message, 'erro')
            } finally {
              setExcluindo(null)
            }
          }}
        />
      )}
    </>
  )
}

function FormularioLocal ({ local, aoSalvar, aoFechar, aoExcluir, aoAbrirPadrao }) {
  const dados = useDados()
  const [f, setF] = useState({
    ...local,
    acoes: Array.isArray(local.acoes) && local.acoes.length ? local.acoes : [...ACOES_PADRAO],
    destinos: Array.isArray(local.destinos) ? local.destinos : []
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const troca = (c, v) => setF(a => ({ ...a, [c]: v }))

  return (
    <Painel
      titulo={local.id ? 'Editar local' : 'Novo local'}
      aoFechar={aoFechar}
      rodape={
        <>
          {local.id && <button className="btn secundario perigo" onClick={aoExcluir}>Excluir</button>}
          <button
            className="btn" disabled={salvando}
            onClick={async () => {
              if (!f.nome?.trim()) return setErro('Informe o nome do local.')
              if (!f.acoes.length) return setErro('Marque pelo menos uma ação permitida.')
              setSalvando(true)
              try { await aoSalvar(f) } catch (e) { setErro(e.message) } finally { setSalvando(false) }
            }}
          >{salvando ? 'Salvando…' : 'Salvar'}</button>
        </>
      }
    >
      <div className="campos">
        <div>
          <label className="rotulo">Nome</label>
          <input className="campo" value={f.nome || ''} onChange={e => troca('nome', e.target.value)} autoCapitalize="words" />
        </div>
        <div>
          <label className="rotulo">Descrição</label>
          <input className="campo" value={f.descricao || ''} onChange={e => troca('descricao', e.target.value)} />
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5 }}>
          <input
            type="checkbox" checked={Boolean(f.requisicaoEnfermagem)}
            onChange={e => troca('requisicaoEnfermagem', e.target.checked)}
            style={{ width: 22, height: 22, accentColor: 'var(--azul-600)', flex: 'none' }}
          />
          <span>
            Habilitado para requisição da enfermagem
            <small style={{ display: 'block', color: 'var(--tinta-fraca)', fontSize: 12.5, marginTop: 2 }}>
              O local aparece como destino no app de plantão. Deixe desmarcado no
              almoxarifado e na farmácia de origem.
            </small>
          </span>
        </label>

        <div>
          <label className="rotulo">Ordem na lista</label>
          <input
            className="campo num" inputMode="numeric" value={f.ordem ?? ''}
            onChange={e => troca('ordem', e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div>
          <label className="rotulo">O que este local aceita</label>
          <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
            {Object.entries(ACOES_ESTOQUE).map(([id, rotulo]) => (
              <label key={id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14.5 }}>
                <input
                  type="checkbox"
                  checked={f.acoes.includes(id)}
                  onChange={e => troca('acoes', e.target.checked
                    ? [...f.acoes, id]
                    : f.acoes.filter(x => x !== id))}
                  style={{ width: 22, height: 22, accentColor: 'var(--azul-600)' }}
                />
                {rotulo}
              </label>
            ))}
          </div>
          {f.acoes.length === 0 && (
            <p className="dica" style={{ color: 'var(--saida)', marginTop: 6 }}>
              Marque pelo menos uma ação, senão ninguém consegue lançar nada aqui.
            </p>
          )}
        </div>

        {f.acoes.includes('transferencia') && (
          <div>
            <label className="rotulo">Pode transferir para</label>
            <p className="dica" style={{ marginBottom: 8 }}>
              Sem nenhum marcado, a transferência é liberada para qualquer local.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {dados.todosEstoques
                .filter(e => e.id !== local.id)
                .map(e => (
                  <label key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14.5 }}>
                    <input
                      type="checkbox"
                      checked={f.destinos.includes(e.id)}
                      onChange={ev => troca('destinos', ev.target.checked
                        ? [...f.destinos, e.id]
                        : f.destinos.filter(x => x !== e.id))}
                      style={{ width: 22, height: 22, accentColor: 'var(--azul-600)' }}
                    />
                    {e.nome}
                  </label>
                ))}
            </div>
          </div>
        )}

        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14.5 }}>
          <input
            type="checkbox" checked={f.ativo !== false} onChange={e => troca('ativo', e.target.checked)}
            style={{ width: 22, height: 22, accentColor: 'var(--azul-600)' }}
          />
          Local ativo
        </label>
        {local.id && (
          <button className="btn secundario bloco-largo" onClick={aoAbrirPadrao}>
            <Icone nome="etiqueta" tamanho={18} /> Itens padrão e estoque mínimo
          </button>
        )}

        {erro && <div className="erro-caixa">{erro}</div>}
      </div>
    </Painel>
  )
}

/**
 * Lista do que cada setor deve manter em estoque, com o mínimo de cada item.
 * É daqui que sai a necessidade de abastecimento e o pedido de compra.
 */
function PainelItensPadrao ({ local, ctx, aoFechar, aoAvisar }) {
  const dados = useDados()
  const [padrao, setPadrao] = useState(() => ({ ...(local.itensPadrao || {}) }))
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [copiarDe, setCopiarDe] = useState('')

  const escolhidos = Object.keys(padrao)

  const resultados = useMemo(() => {
    const t = semAcento(busca).trim()
    return dados.itens
      .filter(i => i.ativo !== false && !i.pendente)
      .filter(i => !tipo || i.tipo === tipo)
      .filter(i => !t || semAcento(`${i.descricao} ${i.principioAtivo} ${i.codigo}`).includes(t))
  }, [dados.itens, busca, tipo])

  const naLista = useMemo(
    () => dados.itens
      .filter(i => padrao[i.id] !== undefined)
      .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
    [dados.itens, padrao]
  )

  const podeAdicionarTodos = (busca.trim() || tipo) && resultados.length > 0

  return (
    <Painel
      titulo="Itens padrão do setor"
      descricao={local.nome}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn secundario" onClick={aoFechar}>Cancelar</button>
          <button
            className="btn" disabled={salvando}
            onClick={async () => {
              setSalvando(true)
              try {
                await salvarItensPadrao(local.id, padrao, ctx)
                aoAvisar(`${Object.keys(padrao).length} item(ns) padrão salvos.`, 'ok')
                aoFechar()
              } catch (e) {
                aoAvisar(e.message, 'erro')
              } finally {
                setSalvando(false)
              }
            }}
          >{salvando ? 'Salvando…' : 'Salvar'}</button>
        </>
      }
    >
      <div className="info-caixa" style={{ marginTop: 12 }}>
        O que este setor deve manter em estoque. O mínimo de cada item guia o
        abastecimento e entra no cálculo do pedido de compra.
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        <input
          className="campo" type="search" value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar item para incluir"
        />

        <div className="pilulas" style={{ marginBottom: 0 }}>
          <button className="pilula" aria-pressed={!tipo} onClick={() => setTipo('')}>Todos</button>
          {Object.entries(TIPOS_ITEM).map(([id, nome]) => (
            <button key={id} className="pilula" aria-pressed={tipo === id} onClick={() => setTipo(id)}>
              {nome}
            </button>
          ))}
        </div>

        {podeAdicionarTodos && (
          <button
            className="btn secundario"
            onClick={() => {
              const novo = { ...padrao }
              resultados.forEach(i => { if (novo[i.id] === undefined) novo[i.id] = 0 })
              setPadrao(novo)
            }}
          >Adicionar os {resultados.length} itens filtrados</button>
        )}

        {dados.estoques.filter(e => e.id !== local.id && Object.keys(e.itensPadrao || {}).length).length > 0 && (
          <div>
            <label className="rotulo">Copiar de outro local</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="campo" value={copiarDe} onChange={e => setCopiarDe(e.target.value)}>
                <option value="">Escolha…</option>
                {dados.estoques
                  .filter(e => e.id !== local.id && Object.keys(e.itensPadrao || {}).length)
                  .map(e => (
                    <option key={e.id} value={e.id}>
                      {e.nome} ({Object.keys(e.itensPadrao).length})
                    </option>
                  ))}
              </select>
              <button
                className="btn secundario" style={{ flex: 'none' }}
                disabled={!copiarDe}
                onClick={() => {
                  const origem = dados.estoques.find(e => e.id === copiarDe)
                  setPadrao(a => ({ ...(origem?.itensPadrao || {}), ...a }))
                  setCopiarDe('')
                }}
              >Copiar</button>
            </div>
            <p className="dica" style={{ marginTop: 5 }}>
              Traz os itens e os mínimos do outro local, sem apagar o que já está aqui.
            </p>
          </div>
        )}
      </div>

      {busca.trim() && (
        <div style={{ marginTop: 12 }}>
          <label className="rotulo">Resultados</label>
          <div className="lista">
            {resultados.slice(0, 20).map(i => (
              <button
                key={i.id} className="linha-item"
                onClick={() => setPadrao(a => ({ ...a, [i.id]: a[i.id] ?? 0 }))}
                disabled={padrao[i.id] !== undefined}
                style={{ opacity: padrao[i.id] !== undefined ? .45 : 1 }}
              >
                <div className="corpo">
                  <div className="nome">{i.descricao}</div>
                  <div className="meta">
                    <span className="etq">{i.codigo}</span>
                    {padrao[i.id] !== undefined && <span>já está na lista</span>}
                  </div>
                </div>
                {padrao[i.id] === undefined && <Icone nome="entrada" tamanho={18} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>
        Lista do setor ({escolhidos.length})
      </h3>

      {naLista.length === 0 ? (
        <p className="dica">
          Nenhum item ainda. Busque acima, ou use o filtro por tipo e adicione todos de uma vez.
        </p>
      ) : (
        <div className="lista">
          {naLista.map(i => {
            const saldo = dados.saldoDe(local.id, i.id)
            const minimo = Number(padrao[i.id]) || 0
            return (
              <div key={i.id} className="cartao" style={{ padding: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 620, lineHeight: 1.3 }}>{i.descricao}</div>
                <div className="meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5, fontSize: 12, color: 'var(--tinta-fraca)' }}>
                  <span className="etq">{i.codigo}</span>
                  <span>saldo aqui: {formatarNumero(saldo)}</span>
                  {minimo > 0 && saldo < minimo && (
                    <span className="etq alerta">faltam {formatarNumero(minimo - saldo)}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <label className="rotulo" style={{ margin: 0 }}>Mínimo</label>
                  <input
                    className="campo num" style={{ maxWidth: 110, minHeight: 44 }}
                    inputMode="numeric" value={padrao[i.id]}
                    onChange={e => setPadrao(a => ({ ...a, [i.id]: e.target.value.replace(/\D/g, '') }))}
                  />
                  <span className="dica">{i.unidade?.toLowerCase()}</span>
                  <button
                    className="btn secundario pequeno" style={{ marginLeft: 'auto' }}
                    onClick={() => setPadrao(a => {
                      const c = { ...a }
                      delete c[i.id]
                      return c
                    })}
                  >Tirar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Painel>
  )
}
