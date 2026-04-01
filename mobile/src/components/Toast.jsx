import { useToast } from '../shared/toast.jsx'

const STYLES = {
  success: 'bg-green-600 text-white',
  error:   'bg-red-600 text-white',
  info:    'bg-indigo-600 text-white',
}

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
}

export default function Toast() {
  const { toasts } = useToast()

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium max-w-sm w-full ${STYLES[t.type] || STYLES.info}`}
        >
          <span className="text-lg leading-none">{ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
