import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({ total_records: 0, total_amount: 0 })
  const [loading, setLoading] = useState(true)

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return dateString
    return d.toLocaleDateString('pt-BR')
  }

  const formatCurrency = (value) => {
    if (value === undefined || value === null || value === '') return '-'
    const number = Number(value)
    if (Number.isNaN(number)) return value
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
  }

  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  const [mappings, setMappings] = useState([])
  const [mappingPath, setMappingPath] = useState('')
  const [mappingName, setMappingName] = useState('')
  const [reloadStatus, setReloadStatus] = useState('')

  const queryParams = new URLSearchParams()
  if (q) queryParams.set('q', q)
  if (dateFrom) queryParams.set('date_from', dateFrom)
  if (dateTo) queryParams.set('date_to', dateTo)
  queryParams.set('limit', limit)
  queryParams.set('offset', page * limit)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
      const [tRes, sRes] = await Promise.all([
        fetch(`${base}/api/transactions?${queryParams.toString()}`),
        fetch(`${base}/api/summary`),
      ])

      if (!tRes.ok || !sRes.ok) {
        throw new Error('Falha ao carregar dados do backend')
      }

      const [txs, summary] = await Promise.all([tRes.json(), sRes.json()])
      setTransactions(txs)
      setSummary(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const fetchMappings = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
      const res = await fetch(`${base}/api/account-mappings`)
      if (!res.ok) throw new Error('Erro ao carregar mapeamentos')
      const data = await res.json()
      setMappings(data)
    } catch (err) {
      console.error(err)
    }
  }

  const saveMapping = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
      const res = await fetch(`${base}/api/account-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: mappingPath, name: mappingName }),
      })
      if (!res.ok) throw new Error('Falha ao salvar mapeamento')
      await fetchMappings()
      setMappingPath('')
      setMappingName('')
    } catch (err) {
      console.error(err)
    }
  }

  const removeMapping = async (path) => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
      const res = await fetch(`${base}/api/account-mappings?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao apagar mapeamento')
      await fetchMappings()
    } catch (err) {
      console.error(err)
    }
  }

  const reloadData = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
      setReloadStatus('Recarregando...')
      const res = await fetch(`${base}/api/reload`, { method: 'POST' })
      if (!res.ok) throw new Error('Falha ao recarregar dados')
      setReloadStatus('Dados recarregados com sucesso')
      fetchData()
    } catch (err) {
      setReloadStatus('Erro no reload')
      console.error(err)
    }
  }

  useEffect(() => {
    fetchData()
    fetchMappings()
  }, [q, dateFrom, dateTo, page])

  if (loading) return <div className="App">Carregando...</div>
  if (error) return <div className="App">Erro: {error}</div>

  return (
    <div className="App">
      <h1>Finanz Dashboard</h1>

      <div className="mapping-card">
        <h2>Configurar conta</h2>
        <div className="mapping-form">
          <label>
            Caminho da conta:
            <input
              type="text"
              value={mappingPath}
              onChange={(e) => setMappingPath(e.target.value)}
              placeholder="CartaoCredito/Bradesco"
            />
          </label>
          <label>
            Nome da conta:
            <input
              type="text"
              value={mappingName}
              onChange={(e) => setMappingName(e.target.value)}
              placeholder="Bradesco"
            />
          </label>
          <button onClick={saveMapping} className="btn-primary">Salvar</button>
        </div>

        <div className="mapping-list">
          <h3>Mapeamentos existentes</h3>
          {mappings.length === 0 ? (
            <p>Nenhum mapeamento configurado.</p>
          ) : (
            <ul>
              {mappings.map((m) => (
                <li key={m.path}>
                  <span>{m.path} → {m.name}</span>
                  <button onClick={() => removeMapping(m.path)}>Excluir</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button onClick={reloadData} className="btn-primary">Recarregar dados</button>
        <div>{reloadStatus}</div>
      </div>

      <div className="summary">
        <strong>Total de lançamentos:</strong> {summary.total_records}
        <br />
        <strong>Total pago:</strong> {formatCurrency(summary.total_amount)}
      </div>

      <div className="filters">
        <label>
          Busca:
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="descrição / categoria"
          />
        </label>
        <label>
          De:
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label>
          Até:
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
      </div>

      <div className="pagination">
        <button onClick={() => setPage((prev) => Math.max(0, prev - 1))} disabled={page === 0}>
          Anterior
        </button>
        <span>Página {page + 1}</span>
        <button
          onClick={() => setPage((prev) => prev + 1)}
          disabled={(page + 1) * limit >= summary.total_records}
        >
          Próxima
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Conta</th>
              <th>Data</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Categoria</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.account_name || '-'}</td>
                <td>{formatDate(t.date)}</td>
                <td>{t.description}</td>
                <td>{formatCurrency(t.amount)}</td>
                <td>{t.category || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default App
