import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

export const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID
}

console.log('FIREBASE CONFIG EM USO', config)

export const configurado = Boolean(config.apiKey && config.projectId)

export const app = initializeApp(config)
export const auth = getAuth(app)

export const db = initializeFirestore(app, {})

/* Cria um usuário sem derrubar a sessão de quem está cadastrando.
   O Firebase troca o usuário logado ao chamar createUser, então usamos
   uma instância paralela e a descartamos em seguida. */
export async function comAppParalelo (tarefa) {
  const paralelo = initializeApp(config, 'paralelo-' + Date.now())
  try {
    return await tarefa(getAuth(paralelo))
  } finally {
    await deleteApp(paralelo)
  }
}
