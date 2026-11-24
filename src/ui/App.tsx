import { useCallback, useEffect, useRef, useState } from 'react'
import { SCENE_CC, STOMP_CC, type CcMessage } from '../core/midiMap'
import { BUTTON_IDS, type ButtonId } from '../core/types'
import { getLeds, getScreen } from '../core/view'
import { useBluetoothMidi, type BleStatus } from '../midi/useBluetoothMidi'
import { useMidi } from '../midi/useMidi'
import { Footswitch } from './Footswitch'
import { MidiLog, type LogEntry } from './MidiLog'
import { Screen, type PanelColor } from './Screen'
import { useController } from './useController'
import { useWakeLock } from './useWakeLock'

const GREEN = '#7EE0A8'
const BLUE = '#8EC5FF'
const AMBER = '#FFB547'

// 2×4 layout from CLAUDE.md, in BUTTON_IDS order (top row, then bottom row).
const BUTTONS: Record<ButtonId, { label: string; sub: string; key: string; color: string }> = {
  stomp1: { label: 'Stomp 1', sub: `CC ${STOMP_CC[0]}`, key: '1', color: GREEN },
  stomp2: { label: 'Stomp 2', sub: `CC ${STOMP_CC[1]}`, key: '2', color: GREEN },
  scene1: { label: 'Scene 1', sub: `CC ${SCENE_CC[0]}`, key: '3', color: BLUE },
  scene2: { label: 'Scene 2', sub: `CC ${SCENE_CC[1]}`, key: '4', color: BLUE },
  preset1: { label: 'Preset 1', sub: 'hold: bank −', key: 'Q', color: AMBER },
  preset2: { label: 'Preset 2', sub: '', key: 'W', color: AMBER },
  preset3: { label: 'Preset 3', sub: 'hold: bank +', key: 'E', color: AMBER },
  tap: { label: 'Tap', sub: 'hold: freeze', key: 'R', color: AMBER },
}

const KEY_TO_BUTTON = new Map<string, ButtonId>(BUTTON_IDS.map((id) => [BUTTONS[id].key.toLowerCase(), id]))
const LOG_SIZE = 60
const PANEL_KEY = 'pm-midi.panel'
const SIDE_KEY = 'pm-midi.side'

export function App() {
  useWakeLock()
  const midi = useMidi()
  const ble = useBluetoothMidi()
  const [log, setLog] = useState<LogEntry[]>([])
  const seq = useRef(0)
  const channelRef = useRef(midi.channel)
  channelRef.current = midi.channel
  const [panel, setPanel] = useState<PanelColor>(
    () => (localStorage.getItem(PANEL_KEY) as PanelColor | null) ?? 'yellow-blue',
  )

  const [sideOpen, setSideOpen] = useState(() => localStorage.getItem(SIDE_KEY) !== 'hidden')
  const toggleSide = () =>
    setSideOpen((open) => {
      localStorage.setItem(SIDE_KEY, open ? 'hidden' : 'shown')
      return !open
    })

  const onMidi = useCallback(
    (msgs: CcMessage[]) => {
      // Bluetooth wins over USB/Web MIDI when connected.
      const via: LogEntry['via'] = ble.send(msgs, channelRef.current) ? 'BLE' : midi.send(msgs) ? 'USB' : null
      const now = performance.now()
      // Newest first.
      const entries = msgs
        .map((msg) => ({ seq: seq.current++, timeMs: now, msg, channel: channelRef.current, via }))
        .reverse()
      setLog((prev) => [...entries, ...prev].slice(0, LOG_SIZE))
    },
    [midi.send, ble.send],
  )

  const { state, press, release } = useController(onMidi)
  const leds = getLeds(state)
  const screen = getScreen(state)

  // Keyboard shortcuts: keydown = press, keyup = release, so holds work too.
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => t instanceof HTMLSelectElement || t instanceof HTMLInputElement
    const down = (e: KeyboardEvent) => {
      const id = KEY_TO_BUTTON.get(e.key.toLowerCase())
      if (!id || e.repeat || e.metaKey || e.ctrlKey || isTyping(e.target)) return
      e.preventDefault()
      press(id)
    }
    const up = (e: KeyboardEvent) => {
      const id = KEY_TO_BUTTON.get(e.key.toLowerCase())
      if (id) release(id)
    }
    const releaseAll = () => BUTTON_IDS.forEach(release)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', releaseAll)
    }
  }, [press, release])

  return (
    <main className="app">
      <button
        type="button"
        className="btn side-toggle"
        onClick={toggleSide}
        aria-expanded={sideOpen}
        aria-controls="side-panels"
      >
        {sideOpen ? 'Hide panels' : 'Show panels'}
      </button>
      <section className="unit" aria-label="Controller">
        <div className="bezel">
          <Screen model={screen} panel={panel} />
        </div>
        <div className="grid">
          {BUTTON_IDS.map((id) => (
            <Footswitch
              key={id}
              id={id}
              label={BUTTONS[id].label}
              sub={BUTTONS[id].sub}
              shortcut={BUTTONS[id].key}
              led={leds[id]}
              ledColor={BUTTONS[id].color}
              down={state.buttons[id].pressedAtMs !== null}
              onPress={press}
              onRelease={release}
            />
          ))}
        </div>
      </section>

      <aside className="side" id="side-panels" hidden={!sideOpen}>
        <section className="settings" aria-label="MIDI settings">
          <h1>Pocket Master MIDI</h1>
          <div className="row">
            <span className="row-label">Bluetooth</span>
            <BleControl
              status={ble.status}
              deviceName={ble.deviceName}
              onConnect={ble.connect}
              onDisconnect={ble.disconnect}
            />
          </div>
          {ble.error && <p className="status warn">Bluetooth: {ble.error}</p>}
          <MidiStatusLine status={midi.status} error={midi.error} portCount={midi.ports.length} />
          <label>
            {ble.status === 'connected' ? 'USB (idle)' : 'Output'}
            <select
              value={midi.portId ?? ''}
              onChange={(e) => midi.setPortId(e.target.value || null)}
              disabled={midi.status !== 'ready'}
            >
              <option value="">None (log only)</option>
              {midi.ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Channel
            <select value={midi.channel} onChange={(e) => midi.setChannel(Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Screen
            <select
              value={panel}
              onChange={(e) => {
                const p = e.target.value as PanelColor
                setPanel(p)
                localStorage.setItem(PANEL_KEY, p)
              }}
            >
              <option value="yellow-blue">Yellow / blue (bicolor)</option>
              <option value="white">White</option>
              <option value="blue">Blue</option>
            </select>
          </label>
        </section>
        <MidiLog entries={log} onClear={() => setLog([])} />
      </aside>
    </main>
  )
}

function BleControl({
  status,
  deviceName,
  onConnect,
  onDisconnect,
}: {
  status: BleStatus
  deviceName: string | null
  onConnect: () => void
  onDisconnect: () => void
}) {
  if (status === 'unsupported') return <span className="status warn">No Web Bluetooth in this browser.</span>
  if (status === 'connecting') return <span className="status">Connecting…</span>
  if (status === 'reconnecting') return <span className="status warn">Link lost, reconnecting…</span>
  if (status === 'connected')
    return (
      <span className="ble-on">
        <span className="dot" aria-hidden="true" />
        <span className="ble-name">{deviceName}</span>
        <button type="button" className="link" onClick={onDisconnect}>
          Disconnect
        </button>
      </span>
    )
  return (
    <button type="button" className="btn" onClick={onConnect}>
      Connect…
    </button>
  )
}

function MidiStatusLine({ status, error, portCount }: { status: string; error: string | null; portCount: number }) {
  if (status === 'unsupported')
    return <p className="status warn">This browser has no Web MIDI. Use Chrome or Edge.</p>
  if (status === 'requesting') return <p className="status">Requesting MIDI access…</p>
  if (status === 'denied') return <p className="status warn">MIDI access denied{error ? `: ${error}` : ''}.</p>
  return (
    <p className="status">
      {portCount === 0
        ? 'No Web MIDI outputs. Use Bluetooth above, or connect the pedal by USB.'
        : `${portCount} output${portCount > 1 ? 's' : ''} available.`}
    </p>
  )
}
