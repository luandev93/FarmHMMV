import { useMemo, useState } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { Confirmar, Icone, Painel, Vazio, useAviso } from '../components/ui'
import { useAuth, traduzirErro } from '../lib/auth'
import { useDados } from '../lib/store'
import {
  PESSOA_VAZIA, salvarPessoa, criarPessoaSemAcesso, excluirPessoa, mudarIdDePessoa
} from '../lib/db'
import { comAppParalelo, auth } from '../firebase'
import {
  CARGOS_ENFERMAGEM, CONSELHOS, DOMINIO_INTERNO, FUNCOES_FARMACIA, MODULOS,
  UFS, dataBR, diasParaAniversario, idade, modulosDe, registroDe,
  semAcento, senhaPeloNascimento, sugerirUsuario
} from '../lib/utils'

export default function Pessoas () {
  const { perfil, usuario, ehAdm } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [busca, setBusca] = useState('')
  const [modulo, setModulo] = useState('')
  const [editando, setEditando] = useState(null)
  const [removendo, setRemovendo] = useState(null)
  const [trocaRT, setTrocaRT] = useState(null)

  const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.farmacia?.funcao || 'adm' }

  const lista = useMemo(() => {
    const t = semAcento(busca).trim()
    return dados.pessoas.filter(p => {
      if (modulo === 'semAcesso') return !p.acesso?.temLogin
      if (modulo && !p[modulo]?.ativo) return false
      if (!t) return true
      return semAcento([p.nome, p.email, registroDe(p)].join(' ')).includes(t)
    })
  }, [dados.pessoas, busca, modulo])

  const aniversariantes = dados.pessoas
    .map(p => ({ ...p, faltam: diasParaAniversario(p.nascimento) }))
    .filter(p => p.faltam !== null && p.faltam <= 30)
    .sort((a, b) => a.faltam - b.faltam)

  /** Cada módulo tem um único RT: ao marcar outro, o anterior é liberado. */
  async function liberarRTAnterior (id, dados_) {
    for (const m of Object.keys(MODULOS)) {
      if (!dados_[m]?.rt) continue
      const anterior = dados.pessoas.find(p => p[m]?.rt && p.id !== id)
      if (anterior) {
        await salvarPessoa(anterior.id, { [m]: { ...anterior[m], rt: false } }, ctx)
      }
    }
  }

  async function gravar (id, corpo) {
    const conflito = Object.keys(MODULOS)
      .filter(m => corpo[m]?.rt)
      .map(m => ({ modulo: m, anterior: dados.pessoas.find(p => p[m]?.rt && p.id !== id) }))
      .find(x => x.anterior)

    if (conflito && !trocaRT) {
      setTrocaRT({ id, corpo, ...conflito })
      return
    }
    await liberarRTAnterior(id, corpo)
    await salvarPessoa(id, corpo, ctx)
    setTrocaRT(null)
    setEditando(null)
    avisar('Cadastro salvo.', 'ok')
  }

  return (
    <>
      {aniversariantes.length > 0 && (
        <div className="cartao bloco">
          <h2 style={{ fontSize: 15, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nome="bolo" tamanho={18} /> Aniversários do mês
          </h2>
          <div className="lista" style={{ marginTop: 10 }}>
            {aniversariantes.map(p => (
              <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
                <span style={{ flex: 1 }}>{p.nome}</span>
                <span className={'etq ' + (p.faltam === 0 ? 'ok' : '')}>
                  {p.faltam === 0 ? 'é hoje!' : p.faltam === 1 ? 'amanhã' : `em ${p.faltam} dias`}
                </span>
                <span className="dica">{dataBR(p.nascimento).slice(0, 5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bloco">
        <input
          className="campo" type="search" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail ou registro"
        />
      </div>

      <div className="pilulas">
        <button className="pilula" aria-pressed={!modulo} onClick={() => setModulo('')}>Todos</button>
        {Object.entries(MODULOS).map(([id, nome]) => (
          <button key={id} className="pilula" aria-pressed={modulo === id} onClick={() => setModulo(id)}>
            {nome}
          </button>
        ))}
        <button
          className="pilula" aria-pressed={modulo === 'semAcesso'}
          onClick={() => setModulo('semAcesso')}
        >Sem acesso</button>
      </div>

      {ehAdm && (
        <button className="btn bloco-largo bloco" onClick={() => setEditando({ ...PESSOA_VAZIA, novo: true })}>
          <Icone nome="entrada" tamanho={18} /> Cadastrar pessoa
        </button>
      )}

      {lista.length === 0 ? (
        <Vazio titulo="Ninguém nesta visão" texto="Ajuste a busca ou troque o filtro acima." />
      ) : (
        <div className="lista">
          {lista.map(p => (
            <button
              key={p.id} className="linha-item"
              onClick={() => ehAdm && setEditando(p)}
              style={{ cursor: ehAdm ? 'pointer' : 'default' }}
            >
              <div className="corpo">
                <div className="nome" style={{ opacity: p.ativo === false ? .5 : 1 }}>{p.nome}</div>
                <div className="meta">
                  {modulosDe(p).map(m => <span key={m} className="etq">{m}</span>)}
                  {registroDe(p) && <span>{registroDe(p)}</span>}
                  {!p.acesso?.temLogin && <span className="etq">sem acesso</span>}
                  {p.nascimento && <span>{dataBR(p.nascimento)} · {idade(p.nascimento)} anos</span>}
                  {Object.entries(MODULOS).filter(([m]) => p[m]?.rt).map(([m, nome]) => (
                    <span key={m} className="etq controle">RT {nome}</span>
                  ))}
                  {p.ativo === false && <span className="etq alerta">suspenso</span>}
                  {p.id === usuario.uid && <span className="etq ok">você</span>}
                </div>
              </div>
              {ehAdm && <Icone nome="seta" tamanho={18} />}
            </button>
          ))}
        </div>
      )}

      {editando && (
        <Formulario
          key={editando.id || 'novo'}
          pessoa={editando}
          souEu={editando.id === usuario.uid}
          criadoPor={perfil.nome}
          aoFechar={() => setEditando(null)}
          aoRemover={() => { setRemovendo(editando); setEditando(null) }}
          aoEnviarRecuperacao={async () => {
            try {
              await sendPasswordResetEmail(auth, editando.email)
              avisar('E-mail de redefinição enviado.', 'ok')
            } catch (e) {
              avisar(traduzirErro(e), 'erro')
            }
          }}
          aoSalvar={async (corpo, senha) => {
            // Cadastro novo com acesso: cria a conta e usa o uid como id.
            if (editando.novo && corpo.acesso.temLogin) {
              await comAppParalelo(async authParalelo => {
                const cred = await createUserWithEmailAndPassword(authParalelo, corpo.email, senha)
                await mudarIdDePessoa(null, cred.user.uid, { ...corpo, senhaProvisoria: true }, ctx)
              })
              setEditando(null)
              return avisar('Pessoa cadastrada com acesso ao sistema.', 'ok')
            }
            if (editando.novo) {
              await criarPessoaSemAcesso(corpo, ctx)
              setEditando(null)
              return avisar('Pessoa cadastrada.', 'ok')
            }
            // Passou a ter acesso: o cadastro muda de id para o uid da conta.
            if (corpo.acesso.temLogin && !editando.acesso?.temLogin) {
              await comAppParalelo(async authParalelo => {
                const cred = await createUserWithEmailAndPassword(authParalelo, corpo.email, senha)
                await mudarIdDePessoa(editando.id, cred.user.uid, { ...corpo, senhaProvisoria: true }, ctx)
              })
              setEditando(null)
              return avisar('Acesso criado para quem já estava cadastrado.', 'ok')
            }
            await gravar(editando.id, corpo)
          }}
        />
      )}

      {trocaRT && (
        <Confirmar
          titulo="Transferir a responsabilidade técnica?"
          texto={`${trocaRT.anterior.nome} é o RT de ${MODULOS[trocaRT.modulo]} hoje. Ao confirmar, a responsabilidade passa e a troca fica registrada na auditoria.`}
          rotuloConfirmar="Transferir"
          aoFechar={() => setTrocaRT(null)}
          aoConfirmar={() => gravar(trocaRT.id, trocaRT.corpo)}
        />
      )}

      {removendo && (
        <Confirmar
          titulo="Excluir do cadastro?"
          texto={
            removendo.acesso?.temLogin
              ? `${removendo.nome} perde o acesso imediatamente. O histórico continua no nome dela. Para apagar a conta de login em definitivo, use o Console do Firebase.`
              : `${removendo.nome} sai das listas de escolha. Os lançamentos já feitos continuam no histórico.`
          }
          rotuloConfirmar="Excluir"
          perigo
          aoFechar={() => setRemovendo(null)}
          aoConfirmar={async () => {
            await excluirPessoa(removendo, ctx)
            setRemovendo(null)
            avisar('Cadastro excluído.', 'ok')
          }}
        />
      )}
    </>
  )
}

function Formulario ({ pessoa, souEu, aoSalvar, aoFechar, aoRemover, aoEnviarRecuperacao }) {
  const [f, setF] = useState({
    ...PESSOA_VAZIA,
    ...pessoa,
    conselho: { ...PESSOA_VAZIA.conselho, ...(pessoa.conselho || {}) },
    acesso: { ...PESSOA_VAZIA.acesso, ...(pessoa.acesso || {}) },
    farmacia: { ...PESSOA_VAZIA.farmacia, ...(pessoa.farmacia || {}) },
    enfermagem: { ...PESSOA_VAZIA.enfermagem, ...(pessoa.enfermagem || {}) },
    medico: { ...PESSOA_VAZIA.medico, ...(pessoa.medico || {}) }
  })
  const [senha, setSenha] = useState('')
  const [senhaPorNascimento, setSenhaPorNascimento] = useState(true)
  const [usarEmailProprio, setUsarEmailProprio] = useState(
    Boolean(pessoa.email && !pessoa.email.endsWith('@' + DOMINIO_INTERNO))
  )
  const [usuarioLogin, setUsuarioLogin] = useState(
    (pessoa.email || '').replace('@' + DOMINIO_INTERNO, '')
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const troca = (c, v) => setF(a => ({ ...a, [c]: v }))
  const trocaModulo = (m, c, v) => setF(a => ({ ...a, [m]: { ...a[m], [c]: v } }))
  const novo = Boolean(pessoa.novo)
  const ganhandoAcesso = f.acesso.temLogin && !pessoa.acesso?.temLogin

  async function enviar () {
    setErro('')
    if (!f.nome.trim()) return setErro('Informe o nome.')

    const email = usarEmailProprio
      ? (f.email || '').trim()
      : `${usuarioLogin.trim()}@${DOMINIO_INTERNO}`

    if ((novo || ganhandoAcesso) && f.acesso.temLogin) {
      if (!usarEmailProprio && !usuarioLogin.trim()) return setErro('Informe o nome de usuário.')
      if (usarEmailProprio && !email) return setErro('Informe o e-mail.')
      if (senhaPorNascimento && !f.nascimento) {
        return setErro('Informe a data de nascimento para gerar a senha inicial.')
      }
      const s = senhaPorNascimento ? senhaPeloNascimento(f.nascimento) : senha
      if (!s || s.length < 6) return setErro('A senha provisória precisa ter pelo menos 6 caracteres.')
      setSalvando(true)
      try { await aoSalvar({ ...f, email }, s) } catch (e) { setErro(traduzirErro(e)) } finally { setSalvando(false) }
      return
    }

    setSalvando(true)
    try { await aoSalvar({ ...f, email: f.acesso.temLogin ? email : '' }, '') }
    catch (e) { setErro(traduzirErro(e)) } finally { setSalvando(false) }
  }

  return (
    <Painel
      titulo={novo ? 'Cadastrar pessoa' : f.nome}
      descricao={novo ? 'A mesma pessoa pode participar de mais de um módulo.' : (f.email || 'sem acesso ao sistema')}
      aoFechar={aoFechar}
      rodape={
        <>
          {!novo && !souEu && <button className="btn secundario perigo" onClick={aoRemover}>Excluir</button>}
          <button className="btn" onClick={enviar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="campos">
        <div>
          <label className="rotulo">Nome completo</label>
          <input
            className="campo" value={f.nome} autoCapitalize="words"
            onChange={e => {
              troca('nome', e.target.value)
              if (novo && !usarEmailProprio) setUsuarioLogin(sugerirUsuario(e.target.value))
            }}
          />
        </div>

        <div className="linha-campos">
          <div>
            <label className="rotulo">Nascimento</label>
            <input
              className="campo" type="date" value={f.nascimento}
              onChange={e => troca('nascimento', e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo">Telefone</label>
            <input className="campo" type="tel" value={f.telefone} onChange={e => troca('telefone', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="rotulo">Conselho de classe</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 0.8fr', gap: 8 }}>
            <select
              className="campo" value={f.conselho.sigla}
              onChange={e => troca('conselho', { ...f.conselho, sigla: e.target.value })}
            >
              <option value="">—</option>
              {CONSELHOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              className="campo num" inputMode="numeric" placeholder="Número"
              value={f.conselho.numero}
              onChange={e => troca('conselho', { ...f.conselho, numero: e.target.value })}
            />
            <select
              className="campo" value={f.conselho.uf}
              onChange={e => troca('conselho', { ...f.conselho, uf: e.target.value })}
            >
              <option value="">UF</option>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* ---------- Módulos ---------- */}

        <Modulo
          titulo="Farmácia" ativo={f.farmacia.ativo}
          aoAtivar={v => { if (!souEu) trocaModulo('farmacia', 'ativo', v) }}
          descricao={
            souEu
              ? 'Você não pode desligar o seu próprio acesso à farmácia.'
              : 'Opera o estoque: movimenta, consulta e, conforme a função, administra.'
          }
          travado={souEu}
        >
          <div>
            <label className="rotulo">Função</label>
            <select
              className="campo" value={f.farmacia.funcao} disabled={souEu}
              onChange={e => trocaModulo('farmacia', 'funcao', e.target.value)}
            >
              {Object.entries(FUNCOES_FARMACIA).map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
            {souEu && <p className="dica" style={{ marginTop: 5 }}>Você não altera a própria função.</p>}
          </div>
          <Marcador
            rotulo="Responsável Técnico da farmácia"
            valor={f.farmacia.rt} aoTrocar={v => trocaModulo('farmacia', 'rt', v)}
          />
        </Modulo>

        <Modulo
          titulo="Enfermagem" ativo={f.enfermagem.ativo}
          aoAtivar={v => trocaModulo('enfermagem', 'ativo', v)}
          descricao="Usa o app de plantão e solicita medicamentos à farmácia."
        >
          <div>
            <label className="rotulo">Cargo</label>
            <select
              className="campo" value={f.enfermagem.cargo}
              onChange={e => trocaModulo('enfermagem', 'cargo', e.target.value)}
            >
              {CARGOS_ENFERMAGEM.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Marcador
            rotulo="Responsável Técnico de enfermagem"
            valor={f.enfermagem.rt} aoTrocar={v => trocaModulo('enfermagem', 'rt', v)}
          />
        </Modulo>

        <Modulo
          titulo="Corpo clínico" ativo={f.medico.ativo}
          aoAtivar={v => trocaModulo('medico', 'ativo', v)}
          descricao="Aparece como prescritor nas dispensações e solicitações."
        >
          <div>
            <label className="rotulo">Especialidade</label>
            <input
              className="campo" value={f.medico.especialidade}
              onChange={e => trocaModulo('medico', 'especialidade', e.target.value)}
              placeholder="Ex.: clínica médica, pediatria"
            />
          </div>
          <Marcador
            rotulo="Diretor técnico / RT do corpo clínico"
            valor={f.medico.rt} aoTrocar={v => trocaModulo('medico', 'rt', v)}
          />
        </Modulo>

        {/* ---------- Acesso ---------- */}

        <div style={{ borderTop: '1px solid var(--borda)', paddingTop: 14, display: 'grid', gap: 12 }}>
          <Marcador
            rotulo="Tem acesso ao sistema"
            dica="Prescritor que só precisa aparecer nas listas não precisa de acesso."
            valor={f.acesso.temLogin}
            aoTrocar={v => troca('acesso', { ...f.acesso, temLogin: v })}
          />

          {f.acesso.temLogin && (novo || ganhandoAcesso) && (
            <>
              <Marcador
                rotulo="Esta pessoa tem e-mail"
                dica="Com e-mail de verdade ela recupera a senha sozinha."
                valor={usarEmailProprio} aoTrocar={setUsarEmailProprio}
              />
              <div>
                <label className="rotulo">{usarEmailProprio ? 'E-mail' : 'Nome de usuário'}</label>
                {usarEmailProprio ? (
                  <input
                    className="campo" type="email" value={f.email} autoCapitalize="none"
                    onChange={e => troca('email', e.target.value)}
                  />
                ) : (
                  <>
                    <input
                      className="campo" value={usuarioLogin} autoCapitalize="none"
                      onChange={e => setUsuarioLogin(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    />
                    <p className="dica" style={{ marginTop: 5 }}>
                      Ela entra com <b>{usuarioLogin || 'usuario'}@{DOMINIO_INTERNO}</b>
                    </p>
                  </>
                )}
              </div>

              <Marcador
                rotulo="Senha inicial pela data de nascimento"
                dica="Formato DDMMAA. O sistema exige a troca no primeiro acesso."
                valor={senhaPorNascimento} aoTrocar={setSenhaPorNascimento}
              />
              <div>
                <label className="rotulo">Senha provisória</label>
                <input
                  className="campo num" type="text"
                  value={senhaPorNascimento ? senhaPeloNascimento(f.nascimento) : senha}
                  readOnly={senhaPorNascimento}
                  onChange={e => setSenha(e.target.value)}
                  placeholder={senhaPorNascimento ? 'preencha o nascimento acima' : ''}
                />
              </div>
            </>
          )}

          {f.acesso.temLogin && !novo && !ganhandoAcesso && (
            <>
              {f.email?.endsWith('@' + DOMINIO_INTERNO) ? (
                <div className="info-caixa">
                  Esta pessoa entra por nome de usuário, sem e-mail de verdade — o link de
                  redefinição não chega a lugar nenhum. Para trocar a senha dela, use o
                  Console do Firebase, em Authentication, e depois marque abaixo para o
                  sistema exigir a troca no próximo acesso.
                </div>
              ) : (
                <button className="btn secundario" onClick={aoEnviarRecuperacao}>
                  <Icone nome="cadeado" tamanho={18} /> Enviar e-mail para redefinir a senha
                </button>
              )}
              <Marcador
                rotulo="Exigir troca de senha no próximo acesso"
                valor={f.senhaProvisoria}
                aoTrocar={v => troca('senhaProvisoria', v)}
              />
            </>
          )}

          {!souEu && (
            <Marcador
              rotulo="Cadastro ativo"
              valor={f.ativo !== false} aoTrocar={v => troca('ativo', v)}
            />
          )}
        </div>

        {erro && <div className="erro-caixa">{erro}</div>}
      </div>
    </Painel>
  )
}

function Modulo ({ titulo, descricao, ativo, aoAtivar, travado, children }) {
  return (
    <div
      style={{
        border: '1.5px solid ' + (ativo ? 'var(--azul-600)' : 'var(--borda)'),
        borderRadius: 'var(--raio-p)',
        padding: 12,
        background: ativo ? 'var(--azul-050)' : 'transparent'
      }}
    >
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5 }}>
        <input
          type="checkbox" checked={Boolean(ativo)} disabled={travado}
          onChange={e => aoAtivar(e.target.checked)}
          style={{ width: 22, height: 22, accentColor: 'var(--azul-600)', flex: 'none', opacity: travado ? .6 : 1 }}
        />
        <span>
          <b>{titulo}</b>
          <small style={{ display: 'block', color: 'var(--tinta-fraca)', fontSize: 12.5, marginTop: 2 }}>
            {descricao}
          </small>
        </span>
      </label>
      {ativo && <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>{children}</div>}
    </div>
  )
}

function Marcador ({ rotulo, dica, valor, aoTrocar }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5 }}>
      <input
        type="checkbox" checked={Boolean(valor)} onChange={e => aoTrocar(e.target.checked)}
        style={{ width: 22, height: 22, accentColor: 'var(--azul-600)', flex: 'none' }}
      />
      <span>
        {rotulo}
        {dica && (
          <small style={{ display: 'block', color: 'var(--tinta-fraca)', fontSize: 12.5, marginTop: 2 }}>
            {dica}
          </small>
        )}
      </span>
    </label>
  )
}
