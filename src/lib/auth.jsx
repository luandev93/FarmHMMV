import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

const Contexto = createContext(null)

export function ProvedorAuth ({ children }) {
  const [usuario, setUsuario] = useState(null)   // conta do Firebase Auth
  const [perfil, setPerfil] = useState(null)     // documento em /usuarios
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUsuario(u)
      if (!u) { setPerfil(null); setCarregando(false) }
    })
  }, [])

  useEffect(() => {
    if (!usuario) return
    setCarregando(true)
    const parar = onSnapshot(
      doc(db, 'pessoas', usuario.uid),
      snap => {
        setPerfil(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setCarregando(false)
      },
      () => { setPerfil(null); setCarregando(false) }
    )
    return parar
  }, [usuario])

  /* A função no estoque vem do módulo Farmácia; quem não participa dele
     não opera o estoque, mesmo tendo acesso ao sistema. */
  const funcao = perfil?.ativo && perfil?.farmacia?.ativo ? perfil.farmacia.funcao : null

  const valor = {
    usuario,
    perfil,
    carregando,
    funcao,
    ehAdm: funcao === 'adm',
    ehFarmaceutico: funcao === 'adm' || funcao === 'farmaceutico',
    entrar: (email, senha) => signInWithEmailAndPassword(auth, email.trim(), senha),
    sair: () => signOut(auth),
    recuperarSenha: email => sendPasswordResetEmail(auth, email.trim()),
    async trocarSenha (senhaAtual, senhaNova) {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, senhaAtual)
      await reauthenticateWithCredential(auth.currentUser, cred)
      await updatePassword(auth.currentUser, senhaNova)
    },
    async salvarMeuPerfil (dados) {
      await setDoc(
        doc(db, 'pessoas', usuario.uid),
        { ...dados, atualizadoEm: serverTimestamp() },
        { merge: true }
      )
    }
  }

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useAuth = () => useContext(Contexto)

/** Traduz os códigos do Firebase para frases que fazem sentido para quem lê. */
export function traduzirErro (e) {
  const c = e?.code || ''
  const mapa = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/user-not-found': 'Não existe conta com esse e-mail.',
    'auth/invalid-email': 'Esse e-mail não é válido.',
    'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Sem conexão. Verifique a internet.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/requires-recent-login': 'Por segurança, saia e entre de novo antes de trocar a senha.',
    'permission-denied': 'Seu perfil não tem permissão para esta ação.'
  }
  return mapa[c] || e?.message || 'Não foi possível concluir. Tente de novo.'
}
