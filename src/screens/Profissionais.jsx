import { useMemo, useState } from 'react'
import { Confirmar, Icone, Painel, Vazio, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarProfissional, excluirProfissional } from '../lib/db'
import { CONSELHOS, TIPOS_PROFISSIONAL, UFS, semAcento } from '../lib/utils'

const CONSELHO_SUGERIDO = {
  prescritor: 'CRM',
  enfermeiro: 'COREN',
  tecnico: 'COREN',
  farmaceutico: 'CRF',
  outro: ''
}

const VAZIO = {
  nome: '', tipo: 'prescritor', conselho: 'CRM', numero: '', uf: '',
  especialidade: '', telefone: '', ativo: true
}

export default function Profissionais () {
  const { perfil, usuario, ehFarmaceutico } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)

  const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.funcao }

  const lista = useMemo(() => {
    const t = semAcento(busca).trim()
    return dados.paraEscolha.filter(p => {
      if (tipo && p.tipo !== tipo) return false
      if (!t) return true
      return semAcento([p.nome, p.numero, p.conselho, p.especialidade].join(' ')).includes(t)
    })
  }, [dados.paraEscolha, busca, tipo])

  const registro = p => [p.conselho, p.numero, p.uf].filter(Boolean).join(' ')

  return (
    <>
      <p className="dica bloco">
        Quem tem acesso ao sistema já aparece automaticamente nas escolhas de prescritor
        e responsável. Cadastre aqui somente quem <b>não</b> tem login — os médicos
        prescritores, principalmente.
      </p>

      <div className="bloco">
        <input
          className="campo" type="search" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou registro"
        />
      </div>

      <div className="pilulas">
        <button className="pilula" aria-pressed={!tipo} onClick={() => setTipo('')}>Todos</button>
        {Object.entries(TIPOS_PROFISSIONAL).map(([id, nome]) => (
          <button key={id} className="pilula" aria-pressed={tipo === id} onClick={() => setTipo(id)}>
            {nome}
          </button>
        ))}
      </div>

      {ehFarmaceutico && (
        <button className="btn bloco-largo bloco" onClick={() => setEditando({ ...VAZIO })}>
          <Icone nome="entrada" tamanho={18} /> Novo profissional
        </button>
      )}

      {lista.length === 0 ? (
        <Vazio
          titulo="Nenhum profissional cadastrado"
          texto="Cadastre os prescritores, enfermeiros e técnicos que aparecem no dia a dia. Depois é só escolher pelo nome na hora do consumo."
        />
      ) : (
        <div className="lista">
          {lista.map(p => (
            <button
              key={p.id} className="linha-item"
              onClick={() => ehFarmaceutico && !p.temAcesso && setEditando(p)}
              style={{ cursor: ehFarmaceutico && !p.temAcesso ? 'pointer' : 'default' }}
            >
              <div className="corpo">
                <div className="nome" style={{ opacity: p.ativo === false ? .5 : 1 }}>{p.nome}</div>
                <div className="meta">
                  <span className="etq">{TIPOS_PROFISSIONAL[p.tipo] || p.tipo}</span>
                  {registro(p) && <span>{registro(p)}</span>}
                  {p.especialidade && <span>{p.especialidade}</span>}
                  {p.ativo === false && <span className="etq alerta">inativo</span>}
                  {p.temAcesso && <span className="etq ok">tem acesso · edite em Pessoas</span>}
                </div>
              </div>
              {ehFarmaceutico && !p.temAcesso && <Icone nome="seta" tamanho={18} />}
            </button>
          ))}
        </div>
      )}

      {editando && (
        <Formulario
          profissional={editando}
          aoFechar={() => setEditando(null)}
          aoExcluir={() => { setExcluindo(editando); setEditando(null) }}
          aoSalvar={async d => {
            await salvarProfissional(d, ctx, editando.id || null)
            setEditando(null)
            avisar('Profissional salvo.', 'ok')
          }}
        />
      )}

      {excluindo && (
        <Confirmar
          titulo="Excluir do cadastro?"
          texto={`"${excluindo.nome}" sai da lista de escolha. Os lançamentos já feitos no nome dele continuam no histórico.`}
          rotuloConfirmar="Excluir"
          perigo
          aoFechar={() => setExcluindo(null)}
          aoConfirmar={async () => {
            try {
              await excluirProfissional(excluindo, ctx)
              avisar('Profissional excluído.', 'ok')
            } catch (e) {
              avisar(e.message, 'erro')
            } finally {
              setExcluindo(null)
            }
          }}
        />
      )}
    </>
  )
}

function Formulario ({ profissional, aoSalvar, aoFechar, aoExcluir }) {
  const [f, setF] = useState({ ...VAZIO, ...profissional })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const troca = (c, v) => setF(a => ({ ...a, [c]: v }))

  return (
    <Painel
      titulo={profissional.id ? 'Editar profissional' : 'Novo profissional'}
      aoFechar={aoFechar}
      rodape={
        <>
          {profissional.id && <button className="btn secundario perigo" onClick={aoExcluir}>Excluir</button>}
          <button
            className="btn" disabled={salvando}
            onClick={async () => {
              if (!f.nome.trim()) return setErro('Informe o nome.')
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
          <input
            className="campo" value={f.nome} autoCapitalize="words"
            onChange={e => troca('nome', e.target.value)}
          />
        </div>

        <div>
          <label className="rotulo">Função</label>
          <select
            className="campo" value={f.tipo}
            onChange={e => {
              const t = e.target.value
              setF(a => ({ ...a, tipo: t, conselho: CONSELHO_SUGERIDO[t] || a.conselho }))
            }}
          >
            {Object.entries(TIPOS_PROFISSIONAL).map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
        </div>

        <div className="linha-campos">
          <div>
            <label className="rotulo">Conselho</label>
            <select className="campo" value={f.conselho} onChange={e => troca('conselho', e.target.value)}>
              <option value="">Sem conselho</option>
              {CONSELHOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo">Número</label>
            <input
              className="campo num" inputMode="numeric" value={f.numero}
              onChange={e => troca('numero', e.target.value)}
            />
          </div>
        </div>

        <div className="linha-campos">
          <div>
            <label className="rotulo">UF do registro</label>
            <select className="campo" value={f.uf} onChange={e => troca('uf', e.target.value)}>
              <option value="">—</option>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo">Telefone</label>
            <input
              className="campo" type="tel" value={f.telefone}
              onChange={e => troca('telefone', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="rotulo">Especialidade ou setor</label>
          <input
            className="campo" value={f.especialidade}
            onChange={e => troca('especialidade', e.target.value)}
            placeholder="Ex.: clínica médica, pediatria, plantão noturno"
          />
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14.5 }}>
          <input
            type="checkbox" checked={f.ativo !== false}
            onChange={e => troca('ativo', e.target.checked)}
            style={{ width: 22, height: 22, accentColor: 'var(--azul-600)' }}
          />
          Aparece na lista de escolha
        </label>

        {erro && <div className="erro-caixa">{erro}</div>}
      </div>
    </Painel>
  )
}
