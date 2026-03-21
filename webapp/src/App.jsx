import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({ total_records: 0, total_amount: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

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

  useEffect(() => {
    fetchData()
  }, [q, dateFrom, dateTo, page])

  if (loading) return <div className="App">Carregando...</div>
  if (error) return <div className="App">Erro: {error}</div>

  return (
    <div className="App">
      <h1>Finanz Dashboard</h1>
      <div className="summary">
        <strong>Total de lançamentos:</strong> {summary.total_records}
        <br />
        <strong>Total pago:</strong> R$ {Number(summary.total_amount || 0).toFixed(2)}
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
                <td>{t.date}</td>
                <td>{t.description}</td>
                <td>{t.amount}</td>
                <td>{t.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default App
