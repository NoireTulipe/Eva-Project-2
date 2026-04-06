export default function IgSlideManager({ slides, currentIdx, onSelect, onAdd, onDelete }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="text-xs text-gray-500 flex-shrink-0">Vignettes :</span>
      {slides.map((s, i) => (
        <div key={s.id} className="flex-shrink-0 relative group">
          <button
            onClick={() => onSelect(i)}
            className={`w-12 h-12 border-2 rounded text-xs font-medium transition-colors ${
              i === currentIdx
                ? 'border-pink-500 bg-pink-50 text-pink-600'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-400'
            }`}
          >
            {i + 1}
          </button>
          {slides.length > 1 && (
            <button
              onClick={() => onDelete(i)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center leading-none"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex-shrink-0 w-12 h-12 border-2 border-dashed border-gray-300 rounded text-gray-400 hover:border-gray-500 hover:text-gray-600 text-xl"
        title="Ajouter une vignette"
      >
        +
      </button>
      <span className="text-xs text-gray-400 ml-1">{slides.length} vignette{slides.length > 1 ? 's' : ''}</span>
    </div>
  )
}
