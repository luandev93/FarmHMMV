import { useState } from 'react'
import { configurado } from '../firebase'
import { useAuth, traduzirErro } from '../lib/auth'
import { Icone } from '../components/ui'

export default function Login () {
  const { entrar, recuperarSenha } = useAuth()
  const [modo, setModo] = useState('entrar')   // entrar | recuperar
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [recado, setRecado] = useState('')

  if (!configurado) {
    return (
      <div className="tela-login">
        <div className="marca">
          <div className="simbolo"><Icone nome="frasco" tamanho={32} /></div>
          <h1>Falta conectar ao Firebase</h1>
          <p>
            Crie o arquivo <b>.env</b> a partir do <b>.env.example</b> com as chaves do seu
            projeto e rode a compilação de novo.
          </p>
        </div>
      </div>
    )
  }

  async function enviar (e) {
    e.preventDefault()
    setErro('')
    setRecado('')
    setOcupado(true)
    try {
      if (modo === 'entrar') {
        await entrar(email, senha)
      } else {
        await recuperarSenha(email)
        setRecado('Se existir conta com esse e-mail, o link de redefinição já está a caminho.')
      }
    } catch (err) {
      setErro(err?.code ? traduzirErro(err) : err.message)
    } finally {
      setOcupado(false)
    }
  }

  const titulos = {
    entrar: {
      h: 'Controle de estoque',
      p: 'O acesso é criado pelo administrador. Se ainda não tem conta, fale com ele.'
    },
    recuperar: {
      h: 'Recuperar a senha',
      p: 'Enviamos um link de redefinição para o seu e-mail.'
    }
  }[modo]

  return (
    <div className="tela-login">
      <div className="marca">
        <div className="simbolo" style={{ color: 'var(--azul-800)' }}>
          <Icone nome="frasco" tamanho={32} />
        </div>
        <h1>{titulos.h}</h1>
        <p>{titulos.p}</p>
      </div>

      <form onSubmit={enviar}>
        <input
          className="campo" type="email" placeholder="E-mail" value={email}
          onChange={e => setEmail(e.target.value)}
          autoCapitalize="none" autoComplete="email" inputMode="email" required
        />

        {modo === 'entrar' && (
          <input
            className="campo" type="password" placeholder="Senha" value={senha}
            onChange={e => setSenha(e.target.value)}
            autoComplete="current-password" required
          />
        )}

        {erro && <div className="erro-caixa">{erro}</div>}
        {recado && <div className="info-caixa">{recado}</div>}

        <button className="btn" disabled={ocupado}>
          {ocupado ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Enviar link'}
        </button>

        <button
          type="button" className="link"
          onClick={() => { setModo(modo === 'entrar' ? 'recuperar' : 'entrar'); setErro(''); setRecado('') }}
        >
          {modo === 'entrar' ? 'Esqueci minha senha' : 'Voltar para a entrada'}
        </button>
      </form>
    </div>
  )
}
