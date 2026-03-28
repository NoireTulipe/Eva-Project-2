import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { auth, produits } from '../../shared/api.js'

export default function Dashboard() {
  const user = auth.getUser()
  const [backendOnline, setBackendOnline] = useState(null)
  const [alertesStock, setAlertesStock] = useState(null)

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.ok ? r.json() : null)
      .then(d => setBackendOnline(!!d))
      .catch(() => setBackendOnline(false))

    produits.getAll()
      .then(data => {
        const alertes = data.filter(p => p.stock <= p.stockAlerte).length
        setAlertesStock(alertes)
      })
      .catch(() => setAlertesStock(null))
  }, [])

  const cards = [
    { to: '/ventes', label: 'Ventes', desc: 'Produits, PDV, sessions de vente' },
    { to: '/admin', label: 'Administration', desc: 'Configuration système' },
    { to: '/logs', label: 'Journaux', desc: 'Erreurs et actions' }
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Bonjour{user?.prenom ? ` ${user.prenom}` : ''}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-block w-2 h-2 rounded-full ${backendOnline === true ? 'bg-green-500' : backendOnline === false ? 'bg-red-500' : 'bg-gray-300'}`}></span>
          <span className="text-gray-500">
            {backendOnline === true ? 'Backend en ligne' : backendOnline === false ? 'Backend hors ligne' : 'Vérification...'}
          </span>
        </div>
      </div>

      {alertesStock !== null && alertesStock > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-4 text-sm">
          <strong>{alertesStock} produit{alertesStock > 1 ? 's' : ''}</strong> en alerte de stock.{' '}
          <Link to="/ventes" className="underline font-medium">Voir les produits</Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(({ to, label, desc }) => (
          <Link key={to} to={to} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
            <h2 className="font-semibold text-gray-800 mb-1">{label}</h2>
            <p className="text-sm text-gray-500">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
