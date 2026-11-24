import { FREEZE_CC, PRESET_INDEX_OFFSET, PRESET_LOAD_CC, SCENE_CC, SCENE_OFF, TAP_CC, type CcMessage } from '../core/midiMap'

export interface LogEntry {
  seq: number
  timeMs: number
  msg: CcMessage
  channel: number
  /** Where it went, or null when no output was available. */
  via: 'BLE' | 'USB' | null
}

export function describeCc({ cc, value }: CcMessage): string {
  if (cc === PRESET_LOAD_CC) return `Load P${String(value - PRESET_INDEX_OFFSET + 1).padStart(2, '0')}`
  if (cc === SCENE_CC[0]) return 'Scene 1'
  if (cc === SCENE_CC[1]) return 'Scene 2'
  if (SCENE_OFF && cc === SCENE_OFF.cc) return 'Scene off'
  if (cc === TAP_CC) return 'Tap'
  if (cc === FREEZE_CC) return value >= 64 ? 'Freeze on' : 'Freeze off'
  return ''
}

export function MidiLog({ entries, onClear }: { entries: LogEntry[]; onClear: () => void }) {
  return (
    <section className="log" aria-label="MIDI log">
      <header>
        <h2>MIDI out</h2>
        <button type="button" className="link" onClick={onClear} disabled={!entries.length}>
          Clear
        </button>
      </header>
      {entries.length === 0 ? (
        <p className="empty">Nothing sent yet. Press a footswitch.</p>
      ) : (
        <ol>
          {entries.map((e) => (
            <li key={e.seq} className={e.via ? '' : 'unsent'}>
              <span className="t">{(e.timeMs / 1000).toFixed(3)}</span>
              <span className="m">
                CH{e.channel} CC {e.msg.cc} = {e.msg.value}
              </span>
              <span className="d">{describeCc(e.msg)}</span>
              <span className="badge">{e.via ?? 'no output'}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
