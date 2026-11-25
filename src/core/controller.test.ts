import { describe, expect, it } from 'vitest'
import { initialState, step } from './controller'
import {
  FREEZE_CC,
  MIDI_OFF,
  MIDI_ON,
  PRESET_INDEX_OFFSET,
  PRESET_LOAD_CC,
  SCENE_CC,
  SCENE_OFF,
  STOMP_FS1_CC,
  TAP_CC,
} from './midiMap'
import { driver } from './testDriver'

const load = (index: number) => ({ cc: PRESET_LOAD_CC, value: index + PRESET_INDEX_OFFSET })

describe('initial state', () => {
  it('starts on P01 without sending anything', () => {
    const s = initialState()
    expect(s.loadedPreset).toBe(0)
    expect(s.activeScene).toBeNull()
    expect(s.freeze).toBe(false)
    expect(s.stomp1).toBe(false)
    expect(s.bpm).toBe(120)
  })
})

describe('presets', () => {
  it('loads on release, not on press', () => {
    const d = driver()
    d.press('preset2')
    expect(d.flush()).toEqual([])
    d.wait(50).release('preset2')
    expect(d.flush()).toEqual([load(1)])
    expect(d.state.loadedPreset).toBe(1)
  })

  it('a tap loads that button in bank A while bank A is loaded', () => {
    const d = driver()
    d.tapButton('preset1').tapButton('preset2').tapButton('preset3').tapButton('preset4')
    expect(d.flush()).toEqual([load(0), load(1), load(2), load(3)])
  })

  it('a tap loads that button in bank B while bank B is loaded', () => {
    const d = driver()
    d.hold('preset1').flush() // P05
    d.tapButton('preset2').tapButton('preset4')
    expect(d.flush()).toEqual([load(5), load(7)])
  })

  it('loading a preset clears the scene', () => {
    const d = driver()
    d.tapButton('scene1')
    expect(d.state.activeScene).toBe(0)
    d.tapButton('preset3')
    expect(d.state.activeScene).toBeNull()
  })
})

describe('banks (hold a preset)', () => {
  it('holding P1 loads P05 at 450 ms, and nothing on release', () => {
    const d = driver()
    d.press('preset1').wait(449)
    expect(d.flush()).toEqual([])
    d.wait(1)
    expect(d.flush()).toEqual([load(4)])
    expect(d.state.loadedPreset).toBe(4)
    d.wait(1000).release('preset1')
    expect(d.flush()).toEqual([])
  })

  it('holding again goes back to bank A', () => {
    const d = driver()
    d.hold('preset1').hold('preset1')
    expect(d.flush()).toEqual([load(4), load(0)])
  })

  it('each button toggles between its own address in A and B', () => {
    const d = driver()
    d.hold('preset2').hold('preset2').hold('preset3').hold('preset4')
    // P06, P02, P07 (from A), P04 (from B)
    expect(d.flush()).toEqual([load(5), load(1), load(6), load(3)])
  })

  it('fires once per hold (no auto-repeat)', () => {
    const d = driver()
    d.hold('preset1', 3000)
    expect(d.flush()).toEqual([load(4)])
  })

  it('holding clears the scene', () => {
    const d = driver()
    d.tapButton('scene2').hold('preset1')
    expect(d.state.activeScene).toBeNull()
  })

  it('detects the hold on release even without a tick in between', () => {
    const r1 = step(initialState(), { type: 'press', id: 'preset3', nowMs: 0 })
    const r2 = step(r1.state, { type: 'release', id: 'preset3', nowMs: 600 })
    expect(r2.out).toEqual([load(6)])
  })
})

describe('scenes', () => {
  it('activates an inactive scene on press', () => {
    const d = driver()
    d.press('scene1')
    expect(d.flush()).toEqual([{ cc: SCENE_CC[0], value: 127 }])
    expect(d.state.activeScene).toBe(0)
  })

  it('switching scenes leaves only one active', () => {
    const d = driver()
    d.tapButton('scene1').flush()
    d.tapButton('scene2')
    expect(d.flush()).toEqual([{ cc: SCENE_CC[1], value: 127 }])
    expect(d.state.activeScene).toBe(1)
  })

  it('pressing the active scene deactivates it', () => {
    const d = driver()
    d.tapButton('scene2').flush()
    d.tapButton('scene2')
    expect(d.flush()).toEqual(SCENE_OFF ? [SCENE_OFF] : [])
    expect(d.state.activeScene).toBeNull()
  })
})

describe('stomp FS1 (tap: toggle, hold: freeze)', () => {
  const stomp = { cc: STOMP_FS1_CC, value: MIDI_ON }
  const on = { cc: FREEZE_CC, value: MIDI_ON }
  const off = { cc: FREEZE_CC, value: MIDI_OFF }

  it('a tap sends CC 80 = 127 on release and toggles its state', () => {
    const d = driver()
    d.press('stomp1')
    expect(d.flush()).toEqual([])
    d.wait(50).release('stomp1')
    expect(d.flush()).toEqual([stomp])
    expect(d.state.stomp1).toBe(true)
    d.tapButton('stomp1')
    expect(d.flush()).toEqual([stomp])
    expect(d.state.stomp1).toBe(false)
  })

  it('loading a preset resets it to off', () => {
    const d = driver()
    d.tapButton('stomp1').tapButton('preset2')
    expect(d.state.stomp1).toBe(false)
    d.tapButton('stomp1').hold('preset3')
    expect(d.state.stomp1).toBe(false)
  })

  it('holding freezes at 450 ms and unfreezes on release, without toggling the stomp', () => {
    const d = driver()
    d.press('stomp1').wait(449)
    expect(d.flush()).toEqual([])
    d.wait(1)
    expect(d.flush()).toEqual([on])
    expect(d.state.freeze).toBe(true)
    d.wait(2000)
    expect(d.flush()).toEqual([])
    d.release('stomp1')
    expect(d.flush()).toEqual([off])
    expect(d.state.freeze).toBe(false)
    expect(d.state.stomp1).toBe(false)
  })

  it('detects the hold on release even without a tick in between', () => {
    const r1 = step(initialState(), { type: 'press', id: 'stomp1', nowMs: 0 })
    const r2 = step(r1.state, { type: 'release', id: 'stomp1', nowMs: 600 })
    expect(r2.out).toEqual([on, off])
    expect(r2.state.freeze).toBe(false)
  })

  it('freeze stays on through a preset change while held', () => {
    const d = driver()
    d.press('stomp1').wait(500).tapButton('preset2')
    expect(d.state.freeze).toBe(true)
    d.release('stomp1')
    expect(d.state.freeze).toBe(false)
  })
})

describe('tap tempo', () => {
  it('sends CC 26 = 127 on every press', () => {
    const d = driver()
    d.press('tap')
    expect(d.flush()).toEqual([{ cc: TAP_CC, value: 127 }])
    d.release('tap')
    expect(d.flush()).toEqual([])
  })

  it('averages the intervals of the last 4 taps', () => {
    const d = driver()
    d.at(1000).tapButton('tap')
    d.at(1500).tapButton('tap')
    expect(d.state.bpm).toBe(120)
    d.at(2100).tapButton('tap') // intervals 500, 600
    expect(d.state.bpm).toBe(109) // 60000 / 550
    d.at(2700).tapButton('tap') // 500, 600, 600
    expect(d.state.bpm).toBe(106) // 60000 / 566.67
    d.at(3300).tapButton('tap') // last 4 taps: 600, 600, 600
    expect(d.state.bpm).toBe(100)
  })

  it('discards taps more than 2 s apart', () => {
    const d = driver()
    d.at(1000).tapButton('tap')
    d.at(1400).tapButton('tap')
    expect(d.state.bpm).toBe(150)
    d.at(4000).tapButton('tap') // 2.6 s later: restarts, bpm unchanged
    expect(d.state.bpm).toBe(150)
    d.at(5000).tapButton('tap')
    expect(d.state.bpm).toBe(60)
  })

  it('clamps BPM to 40–260', () => {
    const fast = driver()
    fast.at(1000).tapButton('tap', 10)
    fast.at(1100).tapButton('tap', 10)
    expect(fast.state.bpm).toBe(260)
    const slow = driver()
    slow.at(1000).tapButton('tap')
    slow.at(2900).tapButton('tap')
    expect(slow.state.bpm).toBe(40)
  })

  it('holding tap does nothing else', () => {
    const d = driver()
    d.hold('tap', 3000)
    expect(d.flush()).toEqual([{ cc: TAP_CC, value: 127 }])
    expect(d.state.freeze).toBe(false)
  })

  it('realigns the beat phase on every tap', () => {
    const d = driver()
    d.at(1234).press('tap')
    expect(d.state.beatAnchorMs).toBe(1234)
  })
})
