import { useState, useEffect } from 'react'
import { admin, instagram } from '../../shared/api.js'

const PROMPT_ROLES = [
  {
    role: 'texte_image',
    label: "Texte dans l'image",
    description: "Prompt pour générer le texte affiché sur les vignettes. Variables : {sujet}, {nbPhrases}, {nbSlides}",
  },
  {
    role: 'reponse_commentaire',
    label: 'Réponse aux commentaires',
    description: 'Prompt pour générer les réponses aux commentaires Instagram. Variables : {commentaire}, {auteur}',
  },
  {
    role: 'reponse_message',
    label: 'Réponse aux messages privés',
    description: 'Prompt pour générer les réponses aux messages directs. Variables : {message}, {expediteur}',
  },
]

export default function IgParametres() {
  const [prompts, setPrompts]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(null)
  const [saved, setSaved]           = useState(null)
  const [edits, setEdits]           = useState({})
  const [oauthStatus, setOauthStatus]   = useState(null)
  const [connecting, setConnecting]     = useState(false)
  const [pollEnabled, setPollEnabled]       = useState(false)
  const [pollInterval, setPollInterval]     = useState(60)
  const [pollLastRun, setPollLastRun]       = useState(null)
  const [savingPoll, setSavingPoll]         = useState(false)
  const [checkpointPending, setCheckpoint]  = useState(false)
  const [checkpointCode, setCheckpointCode] = useState('')
  const [checkpointError, setCheckpointErr] = useState(null)
  const [checkpointOk, setCheckpointOk]     = useState(false)
  const [privateUsername, setPrivateUser]   = useState(null)
  const [privateLoggedIn, setPrivateLogged] = useState(false)
  const [testingConn, setTestingConn]       = useState(false)
  const [testConnInfo, setTestConnInfo]     = useState(null)   // { username, fullName } | null
  const [testConnError, setTestConnError]   = useState(null)
  const [resendingCode, setResendingCode]   = useState(null)   // 'email' | 'sms' | null
  const [resendOk, setResendOk]             = useState(null)   // 'email' | 'sms' | null
  const [forceLogging, setForceLogging]     = useState(false)

  // Lire le statut OAuth, config poll, et résultat du callback depuis l'URL
  useEffect(() => {
    instagram.getOauthStatus().then(setOauthStatus).catch(() => {})
    instagram.getConfig().then(cfg => {
      setPollEnabled(cfg['instagram.poll.enabled'] === 'true')
      setPollInterval(parseInt(cfg['instagram.poll.interval_minutes'] ?? '60'))
      setPollLastRun(cfg['instagram.poll.last_run'] ?? null)
    }).catch(() => {})
    instagram.getPrivateStatus().then(s => {
      setCheckpoint(s.checkpointPending)
      setPrivateLogged(s.loggedIn)
      setPrivateUser(s.username)
    }).catch(() => {})

    const params = new URLSearchParams(window.location.search)
    const result = params.get('oauth')
    if (result === 'success') {
      instagram.getOauthStatus().then(setOauthStatus).catch(() => {})
      window.history.replaceState({}, '', window.location.pathname + '?tab=parametres')
    }
  }, [])

  useEffect(() => {
    admin.getPrompts().then(all => {
      const ig = all.filter(p => p.module === 'instagram')
      setPrompts(ig)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function connecter() {
    setConnecting(true)
    try {
      const { url } = await instagram.getOauthUrl()
      window.location.href = url
    } catch (e) {
      alert(`Erreur : ${e.message}`)
      setConnecting(false)
    }
  }

  async function validerCheckpoint() {
    setCheckpointErr(null)
    try {
      await instagram.submitCheckpointCode(checkpointCode)
      setCheckpoint(false)
      setCheckpointOk(true)
      setCheckpointCode('')
    } catch (e) {
      setCheckpointErr(e.message)
    }
  }

  async function testerConnexion() {
    setTestingConn(true)
    setTestConnInfo(null)
    setTestConnError(null)
    try {
      const r = await instagram.testPrivateConnection()
      setTestConnInfo({ username: r.username, fullName: r.fullName })
      setPrivateUser(r.username)
      setPrivateLogged(true)
      if (checkpointPending) {
        setCheckpoint(false)
        setCheckpointOk(true)
      }
    } catch (e) {
      setTestConnError(e.message)
    } finally {
      setTestingConn(false)
    }
  }

  async function renvoyerCode(method) {
    setResendingCode(method)
    setResendOk(null)
    try {
      await instagram.resendCheckpointCode(method)
      setResendOk(method)
      setTimeout(() => setResendOk(null), 4000)
    } catch (e) {
      setTestConnError(e.message)
    } finally {
      setResendingCode(null)
    }
  }

  async function forceReconnexion() {
    if (!window.confirm('Effacer la session Instagram et forcer une reconnexion ?\nUn nouveau checkpoint sera peut-être demandé.')) return
    setForceLogging(true)
    setTestConnInfo(null)
    setTestConnError(null)
    try {
      const r = await instagram.forceLogin()
      setPrivateLogged(r.loggedIn)
      setCheckpoint(r.checkpointPending)
      if (r.username) setPrivateUser(r.username)
    } catch (e) {
      setTestConnError(e.message)
    } finally {
      setForceLogging(false)
    }
  }

  async function savePoll() {
    setSavingPoll(true)
    try {
      await instagram.setConfig('instagram.poll.enabled', String(pollEnabled))
      await instagram.setConfig('instagram.poll.interval_minutes', String(pollInterval))
    } finally {
      setSavingPoll(false)
    }
  }

  function getContenu(prompt) {
    return edits[prompt.id] ?? prompt.contenu
  }

  async function save(prompt) {
    setSaving(prompt.id)
    try {
      await admin.updatePrompt(prompt.id, { contenu: getContenu(prompt) })
      // Mettre à jour la valeur de référence
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, contenu: getContenu(prompt) } : p))
      setEdits(prev => { const n = { ...prev }; delete n[prompt.id]; return n })
      setSaved(prompt.id)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-gray-400">Chargement…</div>
  }

  return (
    <div className="max-w-2xl p-4 space-y-6">
      <h2 className="text-base font-semibold">Paramètres Instagram</h2>

      {/* ── Connexion OAuth ──────────────────────────────────────────────────── */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-sm">Connexion au compte Instagram</h3>

        {oauthStatus?.connected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              <span className="text-sm text-green-700 font-medium">Connecté</span>
              {oauthStatus.tokenSource === 'env' && (
                <span className="text-xs text-gray-400">(token .env)</span>
              )}
            </div>
            {oauthStatus.igUserId && (
              <p className="text-xs text-gray-500">ID compte : {oauthStatus.igUserId}</p>
            )}
            {oauthStatus.expiresAt && (
              <p className="text-xs text-gray-500">
                Token valide jusqu'au : {new Date(oauthStatus.expiresAt).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            )}
            {oauthStatus.tokenSource !== 'env' && (
              <button onClick={connecter} disabled={connecting}
                className="px-3 py-1.5 text-xs border border-pink-200 text-pink-600 rounded hover:bg-pink-50 disabled:opacity-50">
                {connecting ? 'Redirection…' : 'Reconnecter / Renouveler le token'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Autorisez EVA à accéder à votre compte Instagram Business pour publier, répondre aux commentaires et messages.
            </p>
            <button onClick={connecter} disabled={connecting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium">
              {connecting ? 'Redirection vers Meta…' : '🔗 Connecter le compte Instagram'}
            </button>
            <p className="text-xs text-gray-400">
              Nécessite META_APP_ID et META_APP_SECRET dans le fichier .env du serveur.
            </p>
          </div>
        )}
      </div>

      {/* ── Polling private API ──────────────────────────────────────────────── */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sm">Écoute des commentaires & DMs</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Polling via l'API privée Instagram. Nécessite IG_USERNAME et IG_PASSWORD dans le .env.
            </p>
          </div>
          <button
            onClick={() => setPollEnabled(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${pollEnabled ? 'bg-pink-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${pollEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Compte écouté + test connexion */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${privateLoggedIn ? 'bg-green-500' : checkpointPending ? 'bg-orange-400' : 'bg-gray-300'}`} />
              {privateUsername
                ? <span className="text-gray-700">Compte : <strong>@{privateUsername}</strong></span>
                : <span className="text-gray-400">Non connecté — vérifiez IG_USERNAME dans le .env</span>
              }
            </div>
            <button onClick={testerConnexion} disabled={testingConn || forceLogging}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-50 flex items-center gap-1">
              {testingConn ? <><span className="animate-spin">⟳</span> Test…</> : '⟳ Tester la connexion'}
            </button>
          </div>

          {/* Résultat du test */}
          {testConnInfo && (
            <p className="text-xs text-green-700 font-medium">
              ✓ Connecté en tant que @{testConnInfo.username}{testConnInfo.fullName ? ` (${testConnInfo.fullName})` : ''}
            </p>
          )}
          {testConnError && (
            <p className="text-xs text-red-600">{testConnError}</p>
          )}

          {pollLastRun && (
            <p className="text-xs text-gray-400">
              Dernier cycle : {new Date(pollLastRun).toLocaleString('fr-FR')}
            </p>
          )}
        </div>

        {pollEnabled && (
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 flex-shrink-0">Intervalle (min)</label>
            <input type="number" min={15} max={1440} value={pollInterval}
              onChange={e => setPollInterval(parseInt(e.target.value) || 60)}
              className="w-20 border rounded px-2 py-1 text-sm" />
            <span className="text-xs text-gray-400">(min. 15 min)</span>
          </div>
        )}

        {/* ── Checkpoint Instagram ─────────────────────────────────────────── */}
        {checkpointPending && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-3">
            <p className="text-sm font-medium text-orange-700">
              ⚠ Instagram demande une vérification
            </p>
            <p className="text-xs text-orange-600">
              Parfois Instagram approuve la connexion via une notification dans l'app sans envoyer de code.
              Clique sur <strong>«&nbsp;Tester la connexion&nbsp;»</strong> pour vérifier si c'est déjà validé.
            </p>

            {/* Renvoi du code */}
            <div>
              <p className="text-xs text-gray-600 mb-1.5">Ou demande un nouveau code :</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => renvoyerCode('email')}
                  disabled={resendingCode !== null}
                  className="px-3 py-1.5 text-xs border border-orange-300 text-orange-700 rounded hover:bg-orange-100 disabled:opacity-50">
                  {resendingCode === 'email' ? 'Envoi…' : resendOk === 'email' ? '✓ Email envoyé' : 'Renvoyer par email'}
                </button>
                <button
                  onClick={() => renvoyerCode('sms')}
                  disabled={resendingCode !== null}
                  className="px-3 py-1.5 text-xs border border-orange-300 text-orange-700 rounded hover:bg-orange-100 disabled:opacity-50">
                  {resendingCode === 'sms' ? 'Envoi…' : resendOk === 'sms' ? '✓ SMS envoyé' : 'Renvoyer par SMS'}
                </button>
              </div>
            </div>

            {/* Saisie du code */}
            <div>
              <p className="text-xs text-gray-600 mb-1.5">Saisis le code reçu :</p>
              <div className="flex gap-2">
                <input
                  type="text" value={checkpointCode}
                  onChange={e => setCheckpointCode(e.target.value)}
                  placeholder="Code à 6 chiffres"
                  className="flex-1 border rounded px-2 py-1.5 text-sm"
                  maxLength={8}
                />
                <button onClick={validerCheckpoint} disabled={!checkpointCode.trim()}
                  className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50">
                  Valider
                </button>
              </div>
              {checkpointError && <p className="text-xs text-red-600 mt-1">{checkpointError}</p>}
            </div>
          </div>
        )}

        {checkpointOk && !checkpointPending && (
          <p className="text-xs text-green-600 font-medium">
            ✓ Vérification réussie — le polling reprendra au prochain cycle.
          </p>
        )}

        {/* ── Forcer reconnexion ───────────────────────────────────────────── */}
        <div className="pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-1.5">
            Mauvais compte connecté ou session bloquée ?
          </p>
          <button onClick={forceReconnexion} disabled={forceLogging || testingConn}
            className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50">
            {forceLogging ? 'Reconnexion…' : '↺ Forcer une reconnexion propre'}
          </button>
          <p className="text-xs text-gray-400 mt-1">
            Efface la session sauvegardée et relance un login depuis zéro.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={savePoll} disabled={savingPoll}
            className="px-3 py-1.5 text-xs bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-50">
            {savingPoll ? 'Sauvegarde…' : 'Enregistrer'}
          </button>
          <span className="text-xs text-gray-400">
            Redémarrage d'EVA requis pour appliquer les changements.
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Les prompts sont stockés en base de données et partagés entre tous les utilisateurs.
      </p>

      {PROMPT_ROLES.map(({ role, label, description }) => {
        const prompt = prompts.find(p => p.role === role)
        if (!prompt) return (
          <div key={role} className="border rounded-lg p-4 bg-yellow-50">
            <p className="text-sm text-yellow-700">
              Prompt <code>{role}</code> introuvable — relancez le seed.
            </p>
          </div>
        )
        const contenu = getContenu(prompt)
        const isDirty = edits[prompt.id] !== undefined
        return (
          <div key={prompt.id} className="border rounded-lg p-4 space-y-3">
            <div>
              <h3 className="font-medium text-sm">{label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
            <textarea
              value={contenu}
              onChange={e => setEdits(prev => ({ ...prev, [prompt.id]: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm resize-y font-mono"
              rows={8}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => save(prompt)}
                disabled={saving === prompt.id || !isDirty}
                className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-40"
              >
                {saving === prompt.id ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
              {isDirty && (
                <button
                  onClick={() => setEdits(prev => { const n = { ...prev }; delete n[prompt.id]; return n })}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Annuler
                </button>
              )}
              {saved === prompt.id && (
                <span className="text-sm text-green-600">Sauvegardé ✓</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
