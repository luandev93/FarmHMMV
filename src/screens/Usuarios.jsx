import { useMemo, useState } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { Confirmar, Icone, Painel, useAviso } from '../components/ui'
import { useAuth, traduzirErro } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarPerfilUsuario, excluirPerfilUsuario } from '../lib/db'
import { comAppParalelo, auth } from '../firebase'
import { NOMES_FUNCAO, dataBR, diasParaAniversario, idade } from '../lib/utils'

export default function Usuarios () {
  const { perfil, usuario, ehAdm } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [editando, setEditando] = useState(null)
  const [criando, setCriando] = useState(false)
  const [removendo, setRemovendo] = useState(null)

  const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.funcao }

  const lista = useMemo(
    () => [...dados.usuarios].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')),
    [dados.usuarios]
  )

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
                criadoPor: perfil.nome
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
    nascimento: '', telefone: '', registro: ''
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
        {erro && <div className="erro-caixa">{erro}</div>}
      </div>
    </Painel>
  )
}

function FormularioEdicao ({ pessoa, souEu, aoSalvar, aoFechar, aoRemover, aoEnviarRecuperacao }) {
  const [f, setF] = useState({
    nome: pessoa.nome || '', funcao: pessoa.funcao || 'auxiliar',
    nascimento: pessoa.nascimento || '', telefone: pessoa.telefone || '',
    registro: pessoa.registro || '', ativo: pessoa.ativo !== false
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
            onClick={async () => { setSalvando(true); await aoSalvar(f); setSalvando(false) }}
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
