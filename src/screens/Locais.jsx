import { useState } from 'react'
import { Confirmar, Icone, Painel, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarEstoque, excluirEstoque } from '../lib/db'
import { ACOES_ESTOQUE, ACOES_PADRAO, formatarNumero } from '../lib/utils'

export default function Locais () {
  const { perfil, usuario, ehAdm } = useAuth()
  const dados = useDados()
  const avisar = useAviso()
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)

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
          aoSalvar={async d => {
            await salvarEstoque(d, ctx, editando.id || null)
            setEditando(null)
            avisar('Local salvo.', 'ok')
          }}
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

function FormularioLocal ({ local, aoSalvar, aoFechar, aoExcluir }) {
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
        {erro && <div className="erro-caixa">{erro}</div>}
      </div>
    </Painel>
  )
}
