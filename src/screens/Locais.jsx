import { useState } from 'react'
import { Confirmar, Icone, Painel, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarEstoque, excluirEstoque } from '../lib/db'
import { formatarNumero } from '../lib/utils'

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
        Cada local é um estoque próprio. As transferências acontecem entre eles.
      </p>

      {ehAdm && (
        <button
          className="btn bloco-largo bloco"
          onClick={() => setEditando({ nome: '', descricao: '', ordem: dados.todosEstoques.length + 1, ativo: true })}
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
  const [f, setF] = useState({ ...local })
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
