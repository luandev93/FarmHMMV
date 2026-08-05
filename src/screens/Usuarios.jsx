import { useMemo, useState } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { Confirmar, Icone, Painel, useAviso } from '../components/ui'
import { useAuth, traduzirErro } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarPerfilUsuario, excluirPerfilUsuario } from '../lib/db'
import { comAppParalelo, auth } from '../firebase'
import {
  CARGOS_ENFERMAGEM, NOMES_FUNCAO, SETORES_ENFERMAGEM,
  dataBR, diasParaAniversario, idade
} from '../lib/utils'

export default function Usuarios () {
  const { perfil, usuario, ehAdm } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [editando, setEditando] = useState(null)
  const [criando, setCriando] = useState(false)
  const [removendo, setRemovendo] = useState(null)

  const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.funcao }

  const [area, setArea] = useState('')

  const lista = useMemo(() => {
    const todos = [...dados.usuarios].sort((a, b) =>
      String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
    if (area === 'enfermagem') return todos.filter(u => u.enfermagem?.ativo)
    if (area === 'farmacia') return todos.filter(u => ['adm', 'farmaceutico', 'auxiliar'].includes(u.funcao))
    return todos
  }, [dados.usuarios, area])

  const aniversariantes = lista
    .map(u => ({ ...u, faltam: diasParaAniversario(u.nascimento) }))
    .filter(u => u.faltam !== null && u.faltam <= 30)
    .sort((a, b) => a.faltam - b.faltam)

  return (
    <>
      {aniversariantes.length > 0 && (
        <div className="cartao bloco">
          <h2 style={{ fontSize: 15, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nome="bolo" tamanho={18} /> Aniversários do mês
          </h2>
          <div className="lista" style={{ marginTop: 10 }}>
            {aniversariantes.map(u => (
              <div key={u.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
                <span style={{ flex: 1 }}>{u.nome}</span>
                <span className={'etq ' + (u.faltam === 0 ? 'ok' : '')}>
                  {u.faltam === 0 ? 'é hoje!' : u.faltam === 1 ? 'amanhã' : `em ${u.faltam} dias`}
                </span>
                <span className="dica">{dataBR(u.nascimento).slice(0, 5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pilulas">
        <button className="pilula" aria-pressed={!area} onClick={() => setArea('')}>Todos</button>
        <button className="pilula" aria-pressed={area === 'farmacia'} onClick={() => setArea('farmacia')}>Farmácia</button>
        <button className="pilula" aria-pressed={area === 'enfermagem'} onClick={() => setArea('enfermagem')}>Enfermagem</button>
      </div>

      {ehAdm && (
        <button className="btn bloco-largo bloco" onClick={() => setCriando(true)}>
          <Icone nome="entrada" tamanho={18} /> Cadastrar pessoa
        </button>
      )}

      <div className="lista">
        {lista.map(u => (
          <button
            key={u.id}
            className="linha-item"
            onClick={() => ehAdm && setEditando(u)}
            style={{ cursor: ehAdm ? 'pointer' : 'default' }}
          >
            <div className="corpo">
              <div className="nome" style={{ opacity: u.ativo === false ? .5 : 1 }}>{u.nome}</div>
              <div className="meta">
                <span className="etq">{NOMES_FUNCAO[u.funcao] || u.funcao}</span>
                <span>{u.email}</span>
                {u.nascimento && <span>{dataBR(u.nascimento)} · {idade(u.nascimento)} anos</span>}
                {u.enfermagem?.ativo && (
                  <span className="etq ok">{u.enfermagem.cargo}</span>
                )}
                {u.ativo === false && <span className="etq alerta">acesso suspenso</span>}
                {u.id === usuario.uid && <span className="etq ok">você</span>}
              </div>
            </div>
            {ehAdm && <Icone nome="seta" tamanho={18} />}
          </button>
        ))}
      </div>

      {criando && (
        <FormularioNovo
          aoFechar={() => setCriando(false)}
          aoCriar={async d => {
            await comAppParalelo(async authParalelo => {
              const cred = await createUserWithEmailAndPassword(authParalelo, d.email.trim(), d.senha)
              await salvarPerfilUsuario(cred.user.uid, {
                nome: d.nome.trim(),
                email: d.email.trim().toLowerCase(),
                funcao: d.funcao,
                nascimento: d.nascimento || '',
                telefone: d.telefone || '',
                registro: d.registro || '',
                ativo: true,
                criadoPor: perfil.nome,
                enfermagem: d.naEnfermagem
                  ? {
                      ativo: true,
                      cargo: d.cargo,
                      coren: d.coren?.trim() || '',
                      setorPadrao: d.setorPadrao || ''
                    }
                  : { ativo: false, cargo: '', coren: '', setorPadrao: '' }
              }, ctx)
            })
            setCriando(false)
            avisar('Pessoa cadastrada. Ela já pode entrar com o e-mail e a senha.', 'ok')
          }}
        />
      )}

      {editando && (
        <FormularioEdicao
          pessoa={editando}
          souEu={editando.id === usuario.uid}
          aoFechar={() => setEditando(null)}
          aoRemover={() => { setRemovendo(editando); setEditando(null) }}
          aoEnviarRecuperacao={async () => {
            try {
              await sendPasswordResetEmail(auth, editando.email)
              avisar('E-mail de redefinição de senha enviado.', 'ok')
            } catch (e) {
              avisar(traduzirErro(e), 'erro')
            }
          }}
          aoSalvar={async d => {
            await salvarPerfilUsuario(editando.id, d, ctx)
            setEditando(null)
            avisar('Cadastro atualizado.', 'ok')
          }}
        />
      )}

      {removendo && (
        <Confirmar
          titulo="Revogar o acesso?"
          texto={`${removendo.nome} perde o acesso ao sistema imediatamente. O histórico de movimentações continua registrado no nome dela. Para apagar a conta de login em definitivo, use o Console do Firebase.`}
          rotuloConfirmar="Revogar acesso"
          perigo
          aoFechar={() => setRemovendo(null)}
          aoConfirmar={async () => {
            await excluirPerfilUsuario(removendo, ctx)
            setRemovendo(null)
            avisar('Acesso revogado.', 'ok')
          }}
        />
      )}
    </>
  )
}

function FormularioNovo ({ aoCriar, aoFechar }) {
  const [f, setF] = useState({
    nome: '', email: '', senha: '', funcao: 'auxiliar',
    nascimento: '', telefone: '', registro: '',
    naEnfermagem: false, cargo: 'Técnico(a) de Enfermagem', coren: '', setorPadrao: ''
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const troca = (c, v) => setF(a => ({ ...a, [c]: v }))

  async function enviar () {
    if (!f.nome.trim()) return setErro('Informe o nome.')
    if (!f.email.trim()) return setErro('Informe o e-mail.')
    if (f.senha.length < 6) return setErro('A senha provisória precisa ter pelo menos 6 caracteres.')
    setSalvando(true)
    setErro('')
    try {
      await aoCriar(f)
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Painel
      titulo="Cadastrar pessoa"
      descricao="Ela entra com o e-mail e a senha provisória, e pode trocar a senha depois em Meu perfil."
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn secundario" onClick={aoFechar}>Cancelar</button>
          <button className="btn" onClick={enviar} disabled={salvando}>
            {salvando ? 'Criando…' : 'Criar acesso'}
          </button>
        </>
      }
    >
      <div className="campos">
        <div>
          <label className="rotulo">Nome completo</label>
          <input className="campo" value={f.nome} onChange={e => troca('nome', e.target.value)} autoCapitalize="words" />
        </div>
        <div>
          <label className="rotulo">E-mail</label>
          <input className="campo" type="email" value={f.email} onChange={e => troca('email', e.target.value)} autoCapitalize="none" />
        </div>
        <div>
          <label className="rotulo">Senha provisória</label>
          <input className="campo" type="text" value={f.senha} onChange={e => troca('senha', e.target.value)} />
        </div>
        <div>
          <label className="rotulo">Função</label>
          <select className="campo" value={f.funcao} onChange={e => troca('funcao', e.target.value)}>
            <option value="auxiliar">Auxiliar — movimenta e consulta</option>
            <option value="farmaceutico">Farmacêutico — também faz inventário, catálogo e vê a auditoria</option>
            <option value="adm">Administrador — também gerencia pessoas e configurações</option>
          </select>
        </div>
        <div className="linha-campos">
          <div>
            <label className="rotulo">Nascimento</label>
            <input className="campo" type="date" value={f.nascimento} onChange={e => troca('nascimento', e.target.value)} />
          </div>
          <div>
            <label className="rotulo">Telefone</label>
            <input className="campo" type="tel" value={f.telefone} onChange={e => troca('telefone', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="rotulo">Registro profissional (CRF, COREN…)</label>
          <input className="campo" value={f.registro} onChange={e => troca('registro', e.target.value)} />
        </div>

        <div style={{ borderTop: '1px solid var(--borda)', paddingTop: 14, display: 'grid', gap: 12 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5 }}>
            <input
              type="checkbox" checked={f.naEnfermagem}
              onChange={e => troca('naEnfermagem', e.target.checked)}
              style={{ width: 22, height: 22, accentColor: 'var(--azul-600)', flex: 'none' }}
            />
            <span>
              Faz parte da equipe de enfermagem
              <small style={{ display: 'block', color: 'var(--tinta-fraca)', fontSize: 12.5, marginTop: 2 }}>
                Libera o acesso ao app de relatório de plantão.
              </small>
            </span>
          </label>

          {f.naEnfermagem && (
            <>
              <div>
                <label className="rotulo">Cargo na enfermagem</label>
                <select className="campo" value={f.cargo} onChange={e => troca('cargo', e.target.value)}>
                  {CARGOS_ENFERMAGEM.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="linha-campos">
                <div>
                  <label className="rotulo">COREN</label>
                  <input className="campo" value={f.coren} onChange={e => troca('coren', e.target.value)} />
                </div>
                <div>
                  <label className="rotulo">Setor padrão</label>
                  <select className="campo" value={f.setorPadrao} onChange={e => troca('setorPadrao', e.target.value)}>
                    <option value="">—</option>
                    {SETORES_ENFERMAGEM.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {erro && <div className="erro-caixa">{erro}</div>}
      </div>
    </Painel>
  )
}

function FormularioEdicao ({ pessoa, souEu, aoSalvar, aoFechar, aoRemover, aoEnviarRecuperacao }) {
  const [f, setF] = useState({
    nome: pessoa.nome || '', funcao: pessoa.funcao || 'auxiliar',
    nascimento: pessoa.nascimento || '', telefone: pessoa.telefone || '',
    registro: pessoa.registro || '', ativo: pessoa.ativo !== false,
    naEnfermagem: Boolean(pessoa.enfermagem?.ativo),
    cargo: pessoa.enfermagem?.cargo || 'Técnico(a) de Enfermagem',
    coren: pessoa.enfermagem?.coren || '',
    setorPadrao: pessoa.enfermagem?.setorPadrao || ''
  })
  const [salvando, setSalvando] = useState(false)
  const troca = (c, v) => setF(a => ({ ...a, [c]: v }))

  return (
    <Painel
      titulo={pessoa.nome}
      descricao={pessoa.email}
      aoFechar={aoFechar}
      rodape={
        <>
          {!souEu && <button className="btn secundario perigo" onClick={aoRemover}>Revogar</button>}
          <button
            className="btn"
            disabled={salvando}
            onClick={async () => {
              setSalvando(true)
              const { naEnfermagem, cargo, coren, setorPadrao, ...resto } = f
              await aoSalvar({
                ...resto,
                enfermagem: naEnfermagem
                  ? { ativo: true, cargo, coren: coren.trim(), setorPadrao }
                  : { ativo: false, cargo: '', coren: '', setorPadrao: '' }
              })
              setSalvando(false)
            }}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="campos">
        <div>
          <label className="rotulo">Nome completo</label>
          <input className="campo" value={f.nome} onChange={e => troca('nome', e.target.value)} />
        </div>
        <div>
          <label className="rotulo">Função</label>
          <select
            className="campo" value={f.funcao} disabled={souEu}
            onChange={e => troca('funcao', e.target.value)}
          >
            <option value="auxiliar">Auxiliar</option>
            <option value="farmaceutico">Farmacêutico</option>
            <option value="adm">Administrador</option>
          </select>
          {souEu && <p className="dica" style={{ marginTop: 5 }}>Você não pode alterar a própria função.</p>}
        </div>
        <div className="linha-campos">
          <div>
            <label className="rotulo">Nascimento</label>
            <input className="campo" type="date" value={f.nascimento} onChange={e => troca('nascimento', e.target.value)} />
          </div>
          <div>
            <label className="rotulo">Telefone</label>
            <input className="campo" type="tel" value={f.telefone} onChange={e => troca('telefone', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="rotulo">Registro profissional</label>
          <input className="campo" value={f.registro} onChange={e => troca('registro', e.target.value)} />
        </div>

        <div style={{ borderTop: '1px solid var(--borda)', paddingTop: 14, display: 'grid', gap: 12 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5 }}>
            <input
              type="checkbox" checked={f.naEnfermagem}
              onChange={e => troca('naEnfermagem', e.target.checked)}
              style={{ width: 22, height: 22, accentColor: 'var(--azul-600)', flex: 'none' }}
            />
            <span>
              Faz parte da equipe de enfermagem
              <small style={{ display: 'block', color: 'var(--tinta-fraca)', fontSize: 12.5, marginTop: 2 }}>
                Libera o acesso ao app de relatório de plantão.
              </small>
            </span>
          </label>

          {f.naEnfermagem && (
            <>
              <div>
                <label className="rotulo">Cargo na enfermagem</label>
                <select className="campo" value={f.cargo} onChange={e => troca('cargo', e.target.value)}>
                  {CARGOS_ENFERMAGEM.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="linha-campos">
                <div>
                  <label className="rotulo">COREN</label>
                  <input className="campo" value={f.coren} onChange={e => troca('coren', e.target.value)} />
                </div>
                <div>
                  <label className="rotulo">Setor padrão</label>
                  <select className="campo" value={f.setorPadrao} onChange={e => troca('setorPadrao', e.target.value)}>
                    <option value="">—</option>
                    {SETORES_ENFERMAGEM.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {!souEu && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14.5 }}>
            <input
              type="checkbox" checked={f.ativo} onChange={e => troca('ativo', e.target.checked)}
              style={{ width: 22, height: 22, accentColor: 'var(--azul-600)' }}
            />
            Acesso liberado
          </label>
        )}
        <button className="btn secundario" onClick={aoEnviarRecuperacao}>
          <Icone nome="cadeado" tamanho={18} /> Enviar e-mail para redefinir a senha
        </button>
      </div>
    </Painel>
  )
}
