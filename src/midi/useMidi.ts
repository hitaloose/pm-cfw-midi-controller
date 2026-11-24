// Web MIDI adapter: lists output ports, remembers the chosen port and channel,
// and sends the controller's CC messages. USB works directly; BLE MIDI must be
// paired in the OS first (macOS: Audio MIDI Setup → MIDI Studio → Bluetooth).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CcMessage } from '../core/midiMap'
import { ccBytes } from './ccBytes'

export interface MidiPort {
  id: string
  name: string
}

export type MidiStatus = 'unsupported' | 'requesting' | 'denied' | 'ready'

const PORT_KEY = 'pm-midi.portName'
const CHANNEL_KEY = 'pm-midi.channel'

export function useMidi() {
  const [status, setStatus] = useState<MidiStatus>(() =>
    typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator ? 'requesting' : 'unsupported',
  )
  const [error, setError] = useState<string | null>(null)
  const [ports, setPorts] = useState<MidiPort[]>([])
  const [portId, setPortIdState] = useState<string | null>(null)
  const [channel, setChannelState] = useState<number>(() => {
    const saved = Number(localStorage.getItem(CHANNEL_KEY))
    return saved >= 1 && saved <= 16 ? saved : 1
  })
  const accessRef = useRef<MIDIAccess | null>(null)

  useEffect(() => {
    if (status === 'unsupported') return
    let cancelled = false

    const refresh = () => {
      const access = accessRef.current
      if (!access) return
      const list: MidiPort[] = []
      access.outputs.forEach((o) => {
        if (o.state === 'connected') list.push({ id: o.id, name: o.name ?? o.id })
      })
      setPorts(list)
      // Keep the current port if still there; otherwise restore the saved one by name.
      setPortIdState((current) => {
        if (current && list.some((p) => p.id === current)) return current
        const savedName = localStorage.getItem(PORT_KEY)
        return list.find((p) => p.name === savedName)?.id ?? null
      })
    }

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        if (cancelled) return
        accessRef.current = access
        access.onstatechange = refresh
        setStatus('ready')
        refresh()
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setStatus('denied')
        setError(e instanceof Error ? e.message : String(e))
      })

    return () => {
      cancelled = true
      if (accessRef.current) accessRef.current.onstatechange = null
    }
  }, [status === 'unsupported'])

  const setPortId = useCallback(
    (id: string | null) => {
      setPortIdState(id)
      const name = ports.find((p) => p.id === id)?.name
      if (name) localStorage.setItem(PORT_KEY, name)
      else localStorage.removeItem(PORT_KEY)
    },
    [ports],
  )

  const setChannel = useCallback((ch: number) => {
    setChannelState(ch)
    localStorage.setItem(CHANNEL_KEY, String(ch))
  }, [])

  // Read through refs so `send` stays stable for the controller loop.
  const portIdRef = useRef(portId)
  const channelRef = useRef(channel)
  portIdRef.current = portId
  channelRef.current = channel

  /** Sends the messages; returns false when no port is selected. */
  const send = useCallback((msgs: CcMessage[]): boolean => {
    const id = portIdRef.current
    const output = id ? accessRef.current?.outputs.get(id) : undefined
    if (!output) return false
    for (const m of msgs) output.send(ccBytes(m, channelRef.current))
    return true
  }, [])

  return { status, error, ports, portId, setPortId, channel, setChannel, send }
}
