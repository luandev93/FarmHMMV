import { useState } from 'react'
import { Icone, useAviso } from '../components/ui'
import { useAuth, traduzirErro } from '../lib/auth'
import { NOMES_FUNCAO, dataBR, diasParaAniversario } from '../lib/utils'

export default function Perfil () {
  const { perfil, usuario, salvarMeuPerfil, trocarSenha, recuperarSenha } = useAuth()
  const avisar = useAviso()

  const [f, setF] = useState({
    nome: perfil.nome || '',
    nascimento: perfil.nascimento || '',
    telefone: perfil.telefone || '',
    registro: perfil.registro || ''
  })
  const [salvando, setSalvando] = useState(false)
  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirma: '' })
  const [erroSenha, setErroSenha] = useState('')
  const [trocando, setTrocando] = useState(false)

  const troca = (c, v) => setF(a => ({ ...a, [c]: v }))
  const faltam = diasParaAniversario(perfil.nascimento)

  return (
    <>
      <div className="cartao bloco">
        <div className="rotulo">Conta</div>
        <p style={{ fontSize: 15, fontWeight: 600 }}>{usuario.email}</p>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span className="etq">{NOMES_FUNCAO[perfil.funcao]}</span>
          {perfil.nascimento && (
            <span className="etq">
              {dataBR(perfil.nascimento)}
              {faltam === 0 ? ' · é hoje!' : faltam <= 30 ? ` · faltam ${faltam} dias` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="cartao bloco">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Meus dados</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label className="rotulo">Nome completo</label>
            <input className="campo" value={f.nome} onChange={e => troca('nome', e.target.value)} />
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
          <button
            className="btn" disabled={salvando}
            onClick={async () => {
              setSalvando(true)
              try {
                await salvarMeuPerfil(f)
                avisar('Dados atualizados.', 'ok')
              } catch (e) {
                avisar(traduzirErro(e), 'erro')
              } finally {
                setSalvando(false)
              }
            }}
          >{salvando ? 'Salvando…' : 'Salvar meus dados'}</button>
        </div>
      </div>

      <div className="cartao bloco">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Trocar a senha</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label className="rotulo">Senha atual</label>
            <input
              className="campo" type="password" value={senhas.atual} autoComplete="current-password"
              onChange={e => setSenhas(s => ({ ...s, atual: e.target.value }))}
            />
          </div>
          <div>
            <label className="rotulo">Senha nova</label>
            <input
              className="campo" type="password" value={senhas.nova} autoComplete="new-password"
              onChange={e => setSenhas(s => ({ ...s, nova: e.target.value }))}
            />
          </div>
          <div>
            <label className="rotulo">Repita a senha nova</label>
            <input
              className="campo" type="password" value={senhas.confirma} autoComplete="new-password"
              onChange={e => setSenhas(s => ({ ...s, confirma: e.target.value }))}
            />
          </div>
          {erroSenha && <div className="erro-caixa">{erroSenha}</div>}
          <button
            className="btn secundario" disabled={trocando}
            onClick={async () => {
              setErroSenha('')
              if (senhas.nova.length < 6) return setErroSenha('A senha nova precisa ter pelo menos 6 caracteres.')
              if (senhas.nova !== senhas.confirma) return setErroSenha('As duas senhas novas não coincidem.')
              setTrocando(true)
              try {
                await trocarSenha(senhas.atual, senhas.nova)
                setSenhas({ atual: '', nova: '', confirma: '' })
                avisar('Senha trocada.', 'ok')
              } catch (e) {
                setErroSenha(traduzirErro(e))
              } finally {
                setTrocando(false)
              }
            }}
          >
            <Icone nome="cadeado" tamanho={18} />
            {trocando ? 'Trocando…' : 'Trocar senha'}
          </button>
          <button
            className="btn fantasma"
            onClick={async () => {
              try {
                await recuperarSenha(usuario.email)
                avisar('Enviamos um e-mail com o link de redefinição.', 'ok')
              } catch (e) {
                avisar(traduzirErro(e), 'erro')
              }
            }}
          >Prefiro receber um e-mail para redefinir</button>
        </div>
      </div>
    </>
  )
}
