import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './auth'
import { CONFIG_PADRAO } from './db'
import { chaveSaldo, semAcento, diasAte } from './utils'

const Contexto = createContext(null)

export function ProvedorDados ({ children }) {
  const { perfil } = useAuth()
  const ativo = Boolean(perfil?.ativo)

  const [itens, setItens] = useState([])
  const [estoques, setEstoques] = useState([])
  const [saldos, setSaldos] = useState({})
  const [lotes, setLotes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [config, setConfig] = useState(CONFIG_PADRAO)
  const [prontos, setProntos] = useState({ itens: false, estoques: false, saldos: false })

  useEffect(() => {
    if (!ativo) {
      setItens([]); setEstoques([]); setSaldos({}); setLotes([]); setUsuarios([])
      setProntos({ itens: false, estoques: false, saldos: false })
      return
    }

    const paradas = [
      onSnapshot(collection(db, 'itens'), s => {
        setItens(s.docs.map(d => ({ id: d.id, ...d.data() })))
        setProntos(p => ({ ...p, itens: true }))
      }),
      onSnapshot(collection(db, 'estoques'), s => {
        setEstoques(
          s.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.ordem || 99) - (b.ordem || 99) || a.nome.localeCompare(b.nome))
        )
        setProntos(p => ({ ...p, estoques: true }))
      }),
      onSnapshot(collection(db, 'saldos'), s => {
        const mapa = {}
        s.docs.forEach(d => {
          const v = d.data()
          mapa[chaveSaldo(v.estoqueId, v.itemId)] = v.qtd || 0
        })
        setSaldos(mapa)
        setProntos(p => ({ ...p, saldos: true }))
      }),
      onSnapshot(query(collection(db, 'lotes'), where('qtd', '>', 0)), s => {
        setLotes(s.docs.map(d => ({ id: d.id, ...d.data() })))
      }),
      onSnapshot(collection(db, 'usuarios'), s => {
        setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() })))
      }, () => setUsuarios([])),
      onSnapshot(doc(db, 'config', 'app'), s => {
        setConfig(s.exists() ? { ...CONFIG_PADRAO, ...s.data() } : CONFIG_PADRAO)
      })
    ]

    return () => paradas.forEach(p => p())
  }, [ativo])

  const valor = useMemo(() => {
    const itensOrdenados = [...itens].sort((a, b) =>
      String(a.descricao).localeCompare(String(b.descricao), 'pt-BR')
    )

    // Índice de busca sem acento, montado uma vez a cada mudança do catálogo.
    const indice = itensOrdenados.map(i => ({
      item: i,
      chave: semAcento(
        [i.descricao, i.principioAtivo, i.codigo, i.grupoFarmacologico, i.marca, i.concentracao]
          .filter(Boolean).join(' ')
      )
    }))

    const saldoDe = (estoqueId, itemId) => saldos[chaveSaldo(estoqueId, itemId)] || 0
    const saldoTotal = itemId =>
      estoques.reduce((s, e) => s + saldoDe(e.id, itemId), 0)

    const lotesDe = (estoqueId, itemId) =>
      lotes.filter(l => l.estoqueId === estoqueId && l.itemId === itemId && l.qtd > 0)

    const itemPorId = id => itens.find(i => i.id === id)

    const abaixoDoMinimo = itensOrdenados.filter(i => {
      const min = Number(i.estoqueMinimo) || 0
      return min > 0 && saldoTotal(i.id) < min
    })

    const vencendo = lotes
      .filter(l => l.validade && l.qtd > 0)
      .map(l => ({ ...l, dias: diasAte(l.validade) }))
      .filter(l => l.dias !== null && l.dias <= (config.diasAlertaValidade || 90))
      .sort((a, b) => a.dias - b.dias)

    return {
      itens: itensOrdenados,
      indice,
      estoques: estoques.filter(e => e.ativo !== false),
      todosEstoques: estoques,
      saldos,
      lotes,
      usuarios,
      config,
      carregando: !(prontos.itens && prontos.estoques && prontos.saldos),
      saldoDe,
      saldoTotal,
      lotesDe,
      itemPorId,
      abaixoDoMinimo,
      vencendo
    }
  }, [itens, estoques, saldos, lotes, usuarios, config, prontos])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useDados = () => useContext(Contexto)
