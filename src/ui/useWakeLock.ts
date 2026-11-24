// Keeps the tablet screen on while the controller is open. The browser drops the
// lock whenever the page is hidden, so it is requested again on every return.

import { useEffect } from 'react'

export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let disposed = false

    const request = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        lock = await navigator.wakeLock.request('screen')
        if (disposed) lock.release()
      } catch {
        // Denied (battery saver, no user gesture yet): retried on the next press.
      }
    }

    request()
    document.addEventListener('visibilitychange', request)
    // Some browsers only grant it after a user gesture.
    window.addEventListener('pointerdown', request)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', request)
      window.removeEventListener('pointerdown', request)
      lock?.release()
    }
  }, [])
}
