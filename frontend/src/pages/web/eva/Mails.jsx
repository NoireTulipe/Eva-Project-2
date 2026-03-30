import { useState, useEffect } from 'react'
import { mail } from '../../../shared/api.js'

const PROVIDERS = [
  { value: 'gmail',   label: 'Gmail' },
  { value: 'outlook', label: 'Outlook / Hotmail' },
  { value: 'imap',    label: 'Autre (IMAP)' }
]

const ACTION_LABELS = {
  lire:       { label: 'Lu',        color: 'bg-blue-100 text-blue-700' },
  archiver:   { label: 'Archivé',   color: 'bg-gray-100 text-gray-600' },
  supprimer:  { label: 'Supprimé',  color: 'bg-red-100 text-red-700' },
  marquer_lu: { label: 'Marqué lu', color: 'bg-blue-50 text-blue-500' },
  repondre:   { label: 'Réponse',   color: 'bg-green-100 text-green-700' },
  ignorer:    { label: 'Ignoré',    color: 'bg-yellow-100 text-yellow-700' },
  erreur:     { label: 'Erreur',    color: 'bg-red-50 text-red-400' }
}

export default function Mails() {
  const [onglet, setOnglet] = useState('journal')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mails</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { id: 'journal',    label: 'Journal' },
          { id: 'brouillons', label: 'Brouillons' },
          { id: 'boites',     label: 'Boîtes mail' }
        ].map(o => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              onglet === o.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'journal'    && <OngletJournal />}
      {onglet === 'brouillons' && <OngletBrouillons />}
      {onglet === 'boites'     && <OngletBoites />}
    </div>
  )
}

// ─── Onglet Journal ───────────────────────────────────────────────────────────

function OngletJournal() {
  const [dateSelectionnee, setDateSelectionnee] = useState('')
  const [boites, setBoites] = useState([])
  const [boiteId, setBoiteId] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [detailOuvert, setDetailOuvert] = useState(null)

  useEffect(() => {
    mail.getJournalDates().then(d => {
      setDateSelectionnee(d.length ? d[0] : new Date().toISOString().split('T')[0])
    })
    mail.getBoites().then(setBoites)
  }, [])

  useEffect(() => {
    if (!dateSelectionnee) return
    setLoading(true)
    mail.getJournal({ date: dateSelectionnee, boiteId: boiteId || undefined })
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [dateSelectionnee, boiteId])

  const stats = logs.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={dateSelectionnee}
            onChange={e => setDateSelectionnee(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Boîte</label>
          <select
            value={boiteId}
            onChange={e => setBoiteId(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          >
            <option value="">Toutes les boîtes</option>
            {boites.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <span className="text-sm text-gray-500">{logs.length} mail(s) traité(s)</span>
          {Object.entries(stats).map(([action, nb]) => (
            <span key={action} className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_LABELS[action]?.color || 'bg-gray-100 text-gray-600'}`}>
              {nb} {ACTION_LABELS[action]?.label || action}
            </span>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Chargement…</p>}

      {!loading && logs.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-400 text-center">
          Aucune entrée dans le journal pour cette date.
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Boîte</th>
                <th className="px-4 py-3 text-left">Sujet</th>
                <th className="px-4 py-3 text-left">Expéditeur</th>
                <th className="px-4 py-3 text-left">Catégorie</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Heure</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <LogRow
                  key={log.id}
                  log={log}
                  ouvert={detailOuvert === log.id}
                  onToggle={() => setDetailOuvert(detailOuvert === log.id ? null : log.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LogRow({ log, ouvert, onToggle }) {
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 text-gray-500 text-xs">{log.boiteMail?.nom}</td>
        <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{log.sujet || '(sans sujet)'}</td>
        <td className="px-4 py-3 text-gray-600 text-xs max-w-[160px] truncate">{log.expediteur}</td>
        <td className="px-4 py-3">
          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{log.categorie}</span>
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_LABELS[log.action]?.color || 'bg-gray-100 text-gray-600'}`}>
            {ACTION_LABELS[log.action]?.label || log.action}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
          {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td className="px-4 py-3">
          <button onClick={onToggle} className="text-xs text-indigo-500 hover:text-indigo-700">
            {ouvert ? 'Masquer' : 'Détail'}
          </button>
        </td>
      </tr>
      {ouvert && (
        <tr className="bg-indigo-50">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-gray-600">Raison :</span> <span className="text-gray-700">{log.raison || '—'}</span></p>
              {log.corps && (
                <p><span className="font-medium text-gray-600">Aperçu :</span> <span className="text-gray-500 italic">{log.corps.substring(0, 300)}{log.corps.length > 300 ? '…' : ''}</span></p>
              )}
              {log.action === 'repondre' && log.brouillon && (
                <p><span className="font-medium text-gray-600">Brouillon :</span> <span className="text-green-700">{log.brouillon.substring(0, 200)}…</span></p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Onglet Brouillons ────────────────────────────────────────────────────────

function OngletBrouillons() {
  const [brouillons, setBrouillons] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editTexte, setEditTexte] = useState('')
  const [envoi, setEnvoi] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    mail.getBrouillons().then(setBrouillons).finally(() => setLoading(false))
  }, [])

  async function sauvegarderEdit(id) {
    await mail.updateBrouillon(id, editTexte)
    setBrouillons(prev => prev.map(b => b.id === id ? { ...b, brouillon: editTexte } : b))
    setEditId(null)
  }

  async function envoyer(id) {
    setEnvoi(id)
    setError('')
    try {
      await mail.envoyerBrouillon(id)
      setBrouillons(prev => prev.filter(b => b.id !== id))
    } catch (err) {
      setError(`Erreur d'envoi : ${err.message}`)
    } finally {
      setEnvoi(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Chargement…</p>

  if (!brouillons.length) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-400 text-center">
        Aucun brouillon en attente d'envoi.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded">{error}</div>}
      {brouillons.map(b => (
        <div key={b.id} className="bg-white rounded-lg shadow p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-medium text-gray-800">{b.sujet || '(sans sujet)'}</p>
              <p className="text-sm text-gray-500">À : {b.expediteur} · via {b.boiteMail?.nom}</p>
              <p className="text-xs text-gray-400 mt-0.5">{new Date(b.createdAt).toLocaleString('fr-FR')}</p>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Brouillon EVA</span>
          </div>

          {editId === b.id ? (
            <div className="space-y-2">
              <textarea
                value={editTexte}
                onChange={e => setEditTexte(e.target.value)}
                rows={8}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              />
              <div className="flex gap-2">
                <button onClick={() => sauvegarderEdit(b.id)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">
                  Sauvegarder
                </button>
                <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap font-mono">
                {b.brouillon}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditId(b.id); setEditTexte(b.brouillon || '') }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
                >
                  Modifier
                </button>
                <button
                  onClick={() => envoyer(b.id)}
                  disabled={envoi === b.id}
                  className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {envoi === b.id ? 'Envoi…' : 'Envoyer le mail'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Onglet Boîtes ────────────────────────────────────────────────────────────

const BOITE_VIDE = {
  nom: '', email: '', provider: 'gmail', actif: true,
  imapHost: '', imapPort: 993, imapLogin: '', imapPassword: '',
  smtpHost: '', smtpPort: 587, smtpLogin: '', smtpPassword: '',
  scanNonLuSeulement: true, scanNombre: 20,
  instructionSpecifique: '', salonDiscordRapport: ''
}

const PRESETS = {
  gmail:   { imapHost: 'imap.gmail.com',        imapPort: 993, smtpHost: 'smtp.gmail.com',      smtpPort: 587 },
  outlook: { imapHost: 'outlook.office365.com',  imapPort: 993, smtpHost: 'smtp.office365.com',  smtpPort: 587 }
}

function OngletBoites() {
  const [boites, setBoites] = useState([])
  const [loading, setLoading] = useState(true)
  const [ouvert, setOuvert] = useState(null)
  const [form, setForm] = useState(BOITE_VIDE)
  const [saving, setSaving] = useState(false)
  const [test, setTest] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    mail.getBoites().then(setBoites).finally(() => setLoading(false))
  }, [])

  function ouvrir(boite) {
    setOuvert(boite.id)
    setForm({ ...BOITE_VIDE, ...boite, imapPassword: '', smtpPassword: '' })
    setTest(null); setError('')
  }

  function nouveau() {
    setOuvert('new')
    setForm(BOITE_VIDE)
    setTest(null); setError('')
  }

  function fermer() { setOuvert(null); setTest(null); setError('') }

  function champ(key) {
    return e => {
      const val = e.target.type === 'checkbox' ? e.target.checked
                : e.target.type === 'number'   ? (parseInt(e.target.value) || 0)
                : e.target.value
      setForm(prev => {
        const updated = { ...prev, [key]: val }
        if (key === 'provider' && PRESETS[val]) return { ...updated, ...PRESETS[val] }
        return updated
      })
    }
  }

  async function sauvegarder() {
    if (!form.nom || !form.email || !form.provider) {
      return setError('Nom, email et provider sont requis')
    }
    setSaving(true); setError('')
    try {
      if (ouvert === 'new') {
        const created = await mail.createBoite(form)
        setBoites(prev => [...prev, created])
      } else {
        const updated = await mail.updateBoite(ouvert, form)
        setBoites(prev => prev.map(b => b.id === ouvert ? updated : b))
      }
      fermer()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function supprimer(id) {
    if (!confirm('Supprimer cette boîte et tout son historique ?')) return
    await mail.deleteBoite(id)
    setBoites(prev => prev.filter(b => b.id !== id))
    if (ouvert === id) fermer()
  }

  async function testerConnexion() {
    if (ouvert === 'new') return setError('Sauvegardez d\'abord la boîte avant de tester.')
    setTestLoading(true); setTest(null)
    try {
      const res = await mail.testBoite(ouvert)
      setTest(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setTestLoading(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Chargement…</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{boites.length} boîte(s) configurée(s)</p>
        <button onClick={nouveau} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">
          + Ajouter une boîte
        </button>
      </div>

      {boites.length === 0 && ouvert !== 'new' && (
        <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-400 text-center">
          Aucune boîte mail configurée. Cliquez sur "+ Ajouter une boîte" pour commencer.
        </div>
      )}

      {boites.map(b => (
        <div key={b.id} className="bg-white rounded-lg shadow">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium text-gray-800">{b.nom}</p>
              <p className="text-sm text-gray-500">{b.email} · {PROVIDERS.find(p => p.value === b.provider)?.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Scan : {b.scanNonLuSeulement ? 'non lus' : 'tous'} · max {b.scanNombre}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${b.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {b.actif ? 'Active' : 'Inactive'}
              </span>
              <button onClick={() => ouvrir(b)} className="text-sm text-indigo-600 hover:text-indigo-800 px-2">Modifier</button>
              <button onClick={() => supprimer(b.id)} className="text-sm text-red-400 hover:text-red-600 px-2">Supprimer</button>
            </div>
          </div>
          {ouvert === b.id && (
            <FormulaireBoite
              form={form} champ={champ}
              sauvegarder={sauvegarder} fermer={fermer} saving={saving}
              testerConnexion={testerConnexion} testLoading={testLoading}
              test={test} error={error} isNew={false}
            />
          )}
        </div>
      ))}

      {ouvert === 'new' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-800">Nouvelle boîte mail</h3>
          </div>
          <FormulaireBoite
            form={form} champ={champ}
            sauvegarder={sauvegarder} fermer={fermer} saving={saving}
            testerConnexion={testerConnexion} testLoading={testLoading}
            test={test} error={error} isNew={true}
          />
        </div>
      )}
    </div>
  )
}

function FormulaireBoite({ form, champ, sauvegarder, fermer, saving, testerConnexion, testLoading, test, error, isNew }) {
  const [section, setSection] = useState('general')

  return (
    <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-lg">
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { id: 'general', label: 'Général' },
          { id: 'imap',    label: 'IMAP' },
          { id: 'smtp',    label: 'SMTP' },
          { id: 'eva',     label: 'Instructions EVA' }
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              section === s.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'general' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom affiché" required>
            <input type="text" value={form.nom} onChange={champ('nom')} className={inputCls} placeholder="Ex: Contact ME" />
          </Field>
          <Field label="Adresse email" required>
            <input type="email" value={form.email} onChange={champ('email')} className={inputCls} placeholder="contact@example.com" />
          </Field>
          <Field label="Provider" required>
            <select value={form.provider} onChange={champ('provider')} className={inputCls}>
              {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Statut">
            <label className="flex items-center gap-2 mt-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.actif} onChange={champ('actif')} className="rounded" />
              Boîte active
            </label>
          </Field>
          <Field label="Salon Discord rapport (ID)">
            <input type="text" value={form.salonDiscordRapport} onChange={champ('salonDiscordRapport')} className={inputCls} placeholder="ID du salon Discord" />
          </Field>
        </div>
      )}

      {section === 'imap' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hôte IMAP">
            <input type="text" value={form.imapHost} onChange={champ('imapHost')} className={inputCls} placeholder="imap.gmail.com" />
          </Field>
          <Field label="Port">
            <input type="number" value={form.imapPort} onChange={champ('imapPort')} className={inputCls} />
          </Field>
          <Field label="Identifiant">
            <input type="text" value={form.imapLogin} onChange={champ('imapLogin')} className={inputCls} placeholder="votre@email.com" />
          </Field>
          <Field label={isNew ? 'Mot de passe (app)' : 'Mot de passe (vide = inchangé)'}>
            <input type="password" value={form.imapPassword} onChange={champ('imapPassword')} className={inputCls} placeholder="••••••••" />
          </Field>
          <Field label="Scan" className="col-span-2">
            <div className="flex flex-wrap items-center gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.scanNonLuSeulement} onChange={champ('scanNonLuSeulement')} className="rounded" />
                Non lus uniquement
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                Nombre max :
                <input type="number" value={form.scanNombre} onChange={champ('scanNombre')} min={1} max={100} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" />
              </label>
            </div>
          </Field>
        </div>
      )}

      {section === 'smtp' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hôte SMTP">
            <input type="text" value={form.smtpHost} onChange={champ('smtpHost')} className={inputCls} placeholder="smtp.gmail.com" />
          </Field>
          <Field label="Port">
            <input type="number" value={form.smtpPort} onChange={champ('smtpPort')} className={inputCls} />
          </Field>
          <Field label="Identifiant">
            <input type="text" value={form.smtpLogin} onChange={champ('smtpLogin')} className={inputCls} placeholder="votre@email.com" />
          </Field>
          <Field label={isNew ? 'Mot de passe (app)' : 'Mot de passe (vide = inchangé)'}>
            <input type="password" value={form.smtpPassword} onChange={champ('smtpPassword')} className={inputCls} placeholder="••••••••" />
          </Field>
        </div>
      )}

      {section === 'eva' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Ces instructions s'ajoutent au prompt global mail. Décrivez les règles spécifiques à cette boîte
            (ex : "Les mails de @auteur.com sont prioritaires", "Ne jamais supprimer les mails contenant 'facture'").
          </p>
          <textarea
            value={form.instructionSpecifique}
            onChange={champ('instructionSpecifique')}
            rows={8}
            placeholder="Instructions spécifiques à cette boîte mail…"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
      )}

      {test && (
        <div className="mt-3 p-3 rounded bg-white border border-gray-200 text-sm space-y-1">
          <div className={`flex items-center gap-2 ${test.imap.success ? 'text-green-700' : 'text-red-600'}`}>
            {test.imap.success ? '✓' : '✗'} IMAP : {test.imap.message}
          </div>
          <div className={`flex items-center gap-2 ${test.smtp.success ? 'text-green-700' : 'text-red-600'}`}>
            {test.smtp.success ? '✓' : '✗'} SMTP : {test.smtp.message}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 bg-red-50 text-red-600 text-sm px-3 py-2 rounded">{error}</div>
      )}

      <div className="flex justify-between mt-4">
        <button
          onClick={testerConnexion}
          disabled={testLoading || isNew}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          title={isNew ? 'Sauvegardez d\'abord' : 'Tester IMAP + SMTP'}
        >
          {testLoading ? 'Test…' : 'Tester la connexion'}
        </button>
        <div className="flex gap-2">
          <button onClick={fermer} className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={sauvegarder}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
