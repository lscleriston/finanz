import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({ total_records: 0, total_amount: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
        const [tRes, sRes] = await Promise.all([
          fetch(`${base}/api/transactions?limit=200`),
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

    fetchData()
  }, [])

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

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Categoria</th>
              <th>Fonte</th>
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
                <td>{t.source_file}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default App
