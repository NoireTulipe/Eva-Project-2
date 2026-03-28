export default function Logs() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Journaux</h1>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg">
        <p className="text-gray-500 text-sm">
          La consultation des journaux nécessite un endpoint <code>GET /admin/logs</code> qui n'est pas encore implémenté côté backend.
        </p>
        <p className="text-gray-400 text-xs mt-3">
          Les fichiers <code>errors.log</code> et <code>actions.log</code> sont disponibles sur le serveur dans <code>backend/logs/</code>.
        </p>
      </div>
    </div>
  )
}
