import { useState, useEffect, useCallback } from 'react'
import { admin } from '../../../shared/api.js'

// Événements notifiables — source de vérité côté UI
const EVENEMENTS = [
  { groupe: 'Notes & Rappels', cle: 'notif.notes', label: 'Rappels de notes', description: 'Push + Discord quand un rappel arrive à échéance' },
  { groupe: 'Système', cle: 'notif.backup', label: 'Sauvegardes', description: 'Alerte si la sauvegarde automatique échoue' },
  { groupe: 'Système', cle: 'notif.erreurs', label: 'Erreurs critiques', description: 'Notification pour les erreurs de niveau critique' },
]

export default function Notifications() {
  const [tokens, setTokens] = useState([])
  const [config, setConfig] = useState({})   // { 'notif.notes.push': 'true', ... }
  const [loading, setLoading] = useState(true)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [erreur, setErreur] = useState('')

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const [t, c] = await Promise.all([admin.getNotifTokens(), admin.getNotifConfig()])
      setTokens(t)
      setConfig(Object.fromEntries(c.map(p => [p.cle, p.valeur])))
    } catch {
      setErreur('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { charger() }, [charger])

  async function supprimerToken(id) {
    if (!confirm('Supprimer cet appareil ?')) return
    await admin.deleteNotifToken(id)
    setTokens(prev => prev.filter(t => t.id !== id))
  }

  async function toggleCanal(cle, canal) {
    const key = `${cle}.${canal}`
    const actuel = config[key] !== 'false'  // par défaut activé
    const nouvelleValeur = actuel ? 'false' : 'true'
    const updated = await admin.setNotifConfig(key, nouvelleValeur)
    setConfig(prev => ({ ...prev, [updated.cle]: updated.valeur }))
  }

  function canalActif(cle, canal) {
    const key = `${cle}.${canal}`
    return config[key] !== 'false'  // absent = activé par défaut
  }

  async function envoyerTest() {
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await admin.testPush()
      setTestResult({ ok: true, message: `✓ ${res.succes}/${res.envoyes} appareil(s) notifié(s)` })
    } catch (err) {
      setTestResult({ ok: false, message: err.message })
    } finally {
      setTestLoading(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 mt-6">Chargement…</p>
  if (erreur) return <p className="text-sm text-red-600 mt-6">{erreur}</p>

  const groupes = [...new Set(EVENEMENTS.map(e => e.groupe))]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>

      {/* ── Appareils enregistrés ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">📱 Appareils enregistrés</h2>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            tokens.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {tokens.length} appareil{tokens.length !== 1 ? 's' : ''}
          </span>
        </div>

        {tokens.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">⚠ Aucun appareil enregistré</p>
            <p>L'APK doit être recompilé et réinstallé pour que l'app enregistre son token FCM :</p>
            <code className="block mt-2 text-xs bg-amber-100 rounded px-3 py-2">
              cd mobile &amp;&amp; npm run build &amp;&amp; npx cap sync &amp;&amp; npx cap open android
            </code>
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {t.user?.prenom} {t.user?.nom}
                    <span className="ml-2 text-xs text-gray-400">{t.user?.email}</span>
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                    {t.token.slice(0, 20)}…{t.token.slice(-10)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Enregistré le {new Date(t.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => supprimerToken(t.id)}
                  className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 hover:underline"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Test push ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">🔔 Test de notification</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-3">
            Envoie une notification de test à tous les appareils enregistrés pour vérifier que Firebase est correctement configuré.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={envoyerTest}
              disabled={testLoading || tokens.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {testLoading ? 'Envoi…' : 'Envoyer un test'}
            </button>
            {testResult && (
              <span className={`text-sm font-medium ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Canaux par événement ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">⚙️ Canaux par événement</h2>
        <p className="text-xs text-gray-400 mb-4">
          Par défaut, tous les canaux sont actifs. Désactiver un canal empêche l'envoi pour cet événement.
        </p>

        {groupes.map(groupe => (
          <div key={groupe} className="mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{groupe}</p>
            <div className="space-y-2">
              {EVENEMENTS.filter(e => e.groupe === groupe).map(evt => (
                <div key={evt.cle} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{evt.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{evt.description}</p>
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                      <Toggle
                        label="📱 Push"
                        actif={canalActif(evt.cle, 'push')}
                        onChange={() => toggleCanal(evt.cle, 'push')}
                      />
                      <Toggle
                        label="💬 Discord"
                        actif={canalActif(evt.cle, 'discord')}
                        onChange={() => toggleCanal(evt.cle, 'discord')}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

function Toggle({ label, actif, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
        actif
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-gray-50 border-gray-200 text-gray-400'
      }`}
    >
      <span>{label}</span>
      <span className={`w-8 h-4 rounded-full relative transition-colors ${actif ? 'bg-green-400' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${actif ? 'left-4' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
