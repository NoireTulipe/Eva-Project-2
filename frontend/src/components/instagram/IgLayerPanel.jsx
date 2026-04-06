export default function IgLayerPanel({
  elements, selectedId,
  onSelect, onMoveUp, onMoveDown, onDelete, onDuplicate,
  onToggleVisible, onToggleLock,
}) {
  const reversed = [...elements].reverse()

  return (
    <div className="w-44 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
        Calques
      </div>
      <div className="flex-1 overflow-y-auto">
        {reversed.length === 0 && (
          <p className="text-xs text-gray-400 p-3">Aucun élément</p>
        )}
        {reversed.map((el, i) => {
          const realIdx = elements.length - 1 - i
          const isSelected = el.id === selectedId
          return (
            <div
              key={el.id}
              onClick={() => onSelect(el.id)}
              className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-xs border-b border-gray-100 ${
                isSelected ? 'bg-pink-50' : 'hover:bg-gray-50'
              } ${el.visible === false ? 'opacity-40' : ''}`}
            >
              {/* Icône type */}
              <span className="flex-shrink-0 text-gray-400">
                {el.type === 'text' ? 'T' : '⬜'}
              </span>

              {/* Nom */}
              <span className="flex-1 truncate text-gray-700">
                {el.type === 'text' ? el.text?.slice(0, 14) : el.nom ?? 'image'}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); onToggleVisible(el.id) }}
                  className="p-0.5 rounded hover:bg-gray-200 text-gray-400"
                  title={el.visible === false ? 'Afficher' : 'Masquer'}
                >
                  {el.visible === false ? '👁️' : '👁'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onToggleLock(el.id) }}
                  className="p-0.5 rounded hover:bg-gray-200 text-gray-400"
                  title={el.locked ? 'Déverrouiller' : 'Verrouiller'}
                >
                  {el.locked ? '🔒' : '🔓'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Contrôles calque sélectionné */}
      {selectedId && (
        <div className="border-t border-gray-200 p-2 flex flex-wrap gap-1">
          <button
            onClick={() => onMoveUp(selectedId)}
            className="px-2 py-0.5 text-xs border rounded hover:bg-gray-50"
            title="Monter"
          >↑</button>
          <button
            onClick={() => onMoveDown(selectedId)}
            className="px-2 py-0.5 text-xs border rounded hover:bg-gray-50"
            title="Descendre"
          >↓</button>
          <button
            onClick={() => onDuplicate(selectedId)}
            className="px-2 py-0.5 text-xs border rounded hover:bg-gray-50"
            title="Dupliquer"
          >⧉</button>
          <button
            onClick={() => onDelete(selectedId)}
            className="px-2 py-0.5 text-xs border border-red-200 text-red-500 rounded hover:bg-red-50"
            title="Supprimer"
          >✕</button>
        </div>
      )}
    </div>
  )
}
