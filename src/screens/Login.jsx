import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, configurado } from '../firebase'
import { useAuth, traduzirErro } from '../lib/auth'
import { semear } from '../lib/db'
import { Icone } from '../components/ui'

export default function Login () {
  const { entrar, recuperarSenha } = useAuth()
  const [modo, setModo] = useState('entrar')  // entrar | recuperar | primeiro
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
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
      } else if (modo === 'recuperar') {
        await recuperarSenha(email)
        setRecado('Se existir conta com esse e-mail, o link de redefinição já está a caminho.')
      } else {
        if (!nome.trim()) throw new Error('Informe seu nome.')
        if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha)
        const ctx = { uid: cred.user.uid, nome: nome.trim(), funcao: 'adm' }
        await setDoc(doc(db, 'usuarios', cred.user.uid), {
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          funcao: 'adm',
          nascimento: '',
          ativo: true,
          criadoEm: serverTimestamp()
        })
        await semear(ctx)
      }
    } catch (err) {
      setErro(err?.code ? traduzirErro(err) : err.message)
    } finally {
      setOcupado(false)
    }
  }

  const titulos = {
    entrar: { h: 'Controle de estoque', p: 'Entre para movimentar e consultar o estoque.' },
    recuperar: { h: 'Recuperar a senha', p: 'Enviamos um link de redefinição para o seu e-mail.' },
    primeiro: { h: 'Primeiro acesso', p: 'Crie a conta do administrador. Isso só funciona uma vez, enquanto o sistema estiver vazio.' }
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
        {modo === 'primeiro' && (
          <input
            className="campo" placeholder="Seu nome completo" value={nome}
            onChange={e => setNome(e.target.value)} autoCapitalize="words" autoComplete="name"
          />
        )}

        <input
          className="campo" type="email" placeholder="E-mail" value={email}
          onChange={e => setEmail(e.target.value)}
          autoCapitalize="none" autoComplete="email" inputMode="email" required
        />

        {modo !== 'recuperar' && (
          <input
            className="campo" type="password" placeholder="Senha" value={senha}
            onChange={e => setSenha(e.target.value)}
            autoComplete={modo === 'primeiro' ? 'new-password' : 'current-password'} required
          />
        )}

        {erro && <div className="erro-caixa">{erro}</div>}
        {recado && <div className="info-caixa">{recado}</div>}

        <button className="btn" disabled={ocupado}>
          {ocupado
            ? 'Aguarde…'
            : modo === 'entrar' ? 'Entrar'
              : modo === 'recuperar' ? 'Enviar link'
                : 'Criar administrador'}
        </button>

        {modo === 'entrar' && (
          <>
            <button type="button" className="link" onClick={() => { setModo('recuperar'); setErro('') }}>
              Esqueci minha senha
            </button>
            <button type="button" className="link" onClick={() => { setModo('primeiro'); setErro('') }}>
              Primeiro acesso do sistema
            </button>
          </>
        )}

        {modo !== 'entrar' && (
          <button type="button" className="link" onClick={() => { setModo('entrar'); setErro(''); setRecado('') }}>
            Voltar para a entrada
          </button>
        )}
      </form>
    </div>
  )
}
