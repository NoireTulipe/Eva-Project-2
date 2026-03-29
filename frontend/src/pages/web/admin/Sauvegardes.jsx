import { useState, useEffect } from 'react'
import { admin } from '../../../shared/api.js'

export default function Sauvegardes() {
  const [info, setInfo] = useState(null)
  const [status, setStatus] = useState(null)
  const [backupPath, setBackupPath] = useState(null)  // ConfigParam complet
  const [editPath, setEditPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastBackup, setLastBackup] = useState(null)
  const [restarting, setRestarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      admin.getSauvegardeInfo().catch(() => null),
      admin.getSystemeStatus().catch(() => null),
      admin.getConfig().catch(() => [])
    ]).then(([dbInfo, sys, config]) => {
      setInfo(dbInfo)
      setStatus(sys)
      const param = config.find(p => p.cle === 'backup.path')
      if (param) { setBackupPath(param); setEditPath(param.valeur) }
    })
  }, [])

  async function handleSavePath() {
    if (!backupPath) return
    setSaving(true)
    try {
      await admin.updateConfig(backupPath.id, editPath)
      setBackupPath(prev => ({ ...prev, valeur: editPath }))
    } catch (e) {
      setError(e.message || 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleBackup() {
    setSaving(true)
    setError('')
    try {
      const res = await admin.createSauvegarde()
      setLastBackup(res)
    } catch (e) {
      setError(e.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleRestart() {
    if (!confirm('Redémarrer le backend EVA ?')) return
    setRestarting(true)
    try {
      await admin.restart()
    } catch {
      // Normal — le serveur coupe la connexion avant de répondre
    }
    // Attendre que le serveur revienne (polling /health)
    await pollHealth()
    setRestarting(false)
  }

  async function pollHealth() {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000))
      try {
        const res = await fetch('/api/health')
        if (res.ok) return
      } catch { /* serveur pas encore dispo */ }
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Sauvegardes & Système</h1>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Infos base de données */}
      {info && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Base de données SQLite</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Taille</span>
              <div className="font-medium text-gray-800 mt-0.5">{info.tailleMo} Mo</div>
            </div>
            <div>
              <span className="text-gray-500">Dernière modification</span>
              <div className="font-medium text-gray-800 mt-0.5">
                {new Date(info.modifieLe).toLocaleString('fr-FR')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chemin de sauvegarde */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Destination des sauvegardes</h2>
        <p className="text-xs text-gray-500 mb-3">
          Chemin relatif à <code className="bg-gray-100 px-1 rounded">backend/</code>. Le dossier est créé automatiquement s'il n'existe pas.
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={editPath}
            onChange={e => setEditPath(e.target.value)}
            placeholder="./prisma/"
          />
          <button
            onClick={handleSavePath}
            disabled={saving || editPath === backupPath?.valeur}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40"
          >
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Sauvegarde manuelle */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Sauvegarde manuelle</h2>
        <p className="text-xs text-gray-500 mb-4">
          Copie horodatée de <code className="bg-gray-100 px-1 rounded">dev.db</code> vers{' '}
          <code className="bg-gray-100 px-1 rounded">{backupPath?.valeur || './prisma/'}</code>
        </p>
        <button
          onClick={handleBackup}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Sauvegarde en cours…' : '💾 Sauvegarder maintenant'}
        </button>

        {lastBackup && (
          <div className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <div>✓ Fichier : <code className="font-mono">{lastBackup.fichier}</code></div>
            <div className="text-xs text-green-600 mt-0.5">{lastBackup.chemin}</div>
          </div>
        )}
      </div>

      {/* Système */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Système</h2>

        {status && (
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <span className="text-gray-500">Uptime</span>
              <div className="font-medium text-gray-800 mt-0.5">{status.uptime}</div>
            </div>
            <div>
              <span className="text-gray-500">Mémoire</span>
              <div className="font-medium text-gray-800 mt-0.5">{status.memoire.utilisee} / {status.memoire.totale} Mo</div>
            </div>
            <div>
              <span className="text-gray-500">Node.js</span>
              <div className="font-medium text-gray-800 mt-0.5">{status.nodeVersion}</div>
            </div>
          </div>
        )}

        <button
          onClick={handleRestart}
          disabled={restarting}
          className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {restarting ? 'Redémarrage en cours… (attente)' : '↺ Redémarrer le backend'}
        </button>
        {restarting && (
          <p className="mt-2 text-xs text-gray-500">Le bouton se réactivera automatiquement quand le serveur sera de retour.</p>
        )}
      </div>
    </div>
  )
}
