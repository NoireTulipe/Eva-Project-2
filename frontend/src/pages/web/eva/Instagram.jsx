import { useState } from 'react'
import IgEditeur        from '../../../components/instagram/IgEditeur.jsx'
import IgBibliotheques  from '../../../components/instagram/IgBibliotheques.jsx'
import IgParametres     from '../../../components/instagram/IgParametres.jsx'
import IgMessages       from '../../../components/instagram/IgMessages.jsx'

const ONGLETS = [
  { id: 'editeur',       label: 'Éditeur' },
  { id: 'bibliotheques', label: 'Bibliothèques' },
  { id: 'messages',      label: 'Messages & Commentaires' },
  { id: 'parametres',    label: 'Paramètres' },
]

export default function Instagram() {
  const [onglet, setOnglet] = useState('editeur')

  return (
    <div className="flex flex-col h-full">
      {/* Sous-navigation onglets */}
      <div className="flex border-b border-gray-200 bg-white px-4 gap-1 pt-2">
        {ONGLETS.map(o => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              onglet === o.id
                ? 'bg-pink-50 text-pink-600 border-b-2 border-pink-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-hidden">
        {onglet === 'editeur'       && <IgEditeur />}
        {onglet === 'bibliotheques' && <IgBibliotheques />}
        {onglet === 'messages'      && <IgMessages />}
        {onglet === 'parametres'    && <IgParametres />}
      </div>
    </div>
  )
}
