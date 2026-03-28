export default function AdminLogs() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Journaux</h1>
      <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-500">
        La consultation des journaux nécessite un endpoint <code className="bg-gray-100 px-1 rounded">GET /admin/logs</code> non encore implémenté.
        <p className="text-gray-400 text-xs mt-2">
          Fichiers disponibles sur le serveur : <code className="bg-gray-100 px-1 rounded">backend/logs/errors.log</code> et <code className="bg-gray-100 px-1 rounded">backend/logs/actions.log</code>
        </p>
      </div>
    </div>
  )
}
