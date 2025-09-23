import { useEffect, useRef } from 'react'

export type PauseMenuProps = {
  open: boolean
  onClose: () => void
  onSignOut: () => Promise<void> | void
}

export default function PauseMenu({ open, onClose, onSignOut }: PauseMenuProps) {
  const firstButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (open) {
      // focus first button when open
      firstButtonRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-[90%] max-w-md rounded-xl border border-indigo-500/30 bg-gray-900/95 shadow-2xl p-6 text-gray-100"
      >
        <h2 className="text-2xl font-bold text-center mb-2 text-indigo-300">Paused</h2>
        <p className="text-center text-gray-400 mb-6">Take a breather. What would you like to do?</p>

        <div className="space-y-3">
          <button
            ref={firstButtonRef}
            onClick={onClose}
            className="w-full px-4 py-3 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-semibold shadow"
          >
            Resume
          </button>

          <button
            onClick={() => {
              // Placeholder for settings
              // In the future we can open a nested settings view
              alert('Settings coming soon')
            }}
            className="w-full px-4 py-3 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 font-semibold"
          >
            Settings
          </button>

          <button
            onClick={async () => {
              await onSignOut()
            }}
            className="w-full px-4 py-3 rounded-md bg-red-600/90 hover:bg-red-600 font-semibold"
          >
            Sign out
          </button>
        </div>

        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-md p-2 text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59 7.11 5.7a1 1 0 10-1.41 1.42L10.59 12l-4.9 4.89a1 1 0 101.41 1.42L12 13.41l4.89 4.9a1 1 0 001.42-1.41L13.41 12l4.9-4.89a1 1 0 000-1.4z" />
          </svg>
        </button>

        <p className="mt-4 text-center text-xs text-gray-500">Press P to resume</p>
      </div>
    </div>
  )
}
