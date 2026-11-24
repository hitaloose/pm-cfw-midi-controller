// Runs the core state machine in the browser: feeds it press/release events
// and a requestAnimationFrame tick, and hands its MIDI output to `onMidi`.

import { useCallback, useEffect, useRef, useState } from 'react'
import { initialState, step } from '../core/controller'
import type { CcMessage } from '../core/midiMap'
import type { ButtonId, ControllerEvent, ControllerState } from '../core/types'
import { getDisplay } from '../core/display'
import { getLeds } from '../core/view'

const viewKey = (s: ControllerState) => JSON.stringify([getLeds(s), getDisplay(s), s.buttons])

export function useController(onMidi: (msgs: CcMessage[]) => void) {
  const stateRef = useRef<ControllerState>(initialState())
  const [state, setState] = useState(stateRef.current)
  const keyRef = useRef(viewKey(stateRef.current))
  const onMidiRef = useRef(onMidi)
  onMidiRef.current = onMidi

  const dispatch = useCallback((event: ControllerEvent) => {
    const { state: next, out } = step(stateRef.current, event)
    stateRef.current = next
    if (out.length) onMidiRef.current(out)
    // Only re-render when something visible changed (ticks run every frame).
    const key = viewKey(next)
    if (key !== keyRef.current) {
      keyRef.current = key
      setState(next)
    }
  }, [])

  useEffect(() => {
    let frame = 0
    const loop = () => {
      dispatch({ type: 'tick', nowMs: Math.round(performance.now()) })
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [dispatch])

  const press = useCallback(
    (id: ButtonId) => dispatch({ type: 'press', id, nowMs: Math.round(performance.now()) }),
    [dispatch],
  )
  const release = useCallback(
    (id: ButtonId) => dispatch({ type: 'release', id, nowMs: Math.round(performance.now()) }),
    [dispatch],
  )

  return { state, press, release }
}
