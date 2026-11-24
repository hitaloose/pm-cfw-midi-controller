import { describe, expect, it } from 'vitest'
import { BANK_COUNT } from './config'
import { initialState, step } from './controller'
import { FREEZE_CC, PRESET_INDEX_OFFSET, PRESET_LOAD_CC, SCENE_CC, SCENE_OFF, STOMP_CC, TAP_CC } from './midiMap'
import { driver } from './testDriver'

const load = (index: number) => ({ cc: PRESET_LOAD_CC, value: index + PRESET_INDEX_OFFSET })

describe('initial state', () => {
  it('starts on B01/P01 without sending anything', () => {
    const s = initialState()
    expect(s.displayedBank).toBe(0)
    expect(s.loadedPreset).toBe(0)
    expect(s.activeScene).toBeNull()
    expect(s.stomps).toEqual([false, false])
    expect(s.freeze).toBe(false)
    expect(s.bpm).toBe(120)
  })
})

describe('presets', () => {
  it('loads bank*3+slot on release, not on press', () => {
    const d = driver()
    d.press('preset2')
    expect(d.flush()).toEqual([])
    d.wait(50).release('preset2')
    expect(d.flush()).toEqual([load(1)])
    expect(d.state.loadedPreset).toBe(1)
  })

  it('maps each slot of the displayed bank', () => {
    const d = driver()
    d.hold('preset3').flush() // B02
    d.tapButton('preset1').tapButton('preset2').tapButton('preset3')
    expect(d.flush()).toEqual([load(3), load(4), load(5)])
  })

  it('slot 3 of B17 does nothing', () => {
    const d = driver()
    d.hold('preset1').flush() // wrap to B17
    expect(d.state.displayedBank).toBe(BANK_COUNT - 1)
    d.tapButton('preset1').tapButton('preset2')
    expect(d.flush()).toEqual([load(48), load(49)])
    d.tapButton('preset3')
    expect(d.flush()).toEqual([])
    expect(d.state.loadedPreset).toBe(49)
  })

  it('loading a preset clears scene and stomps', () => {
    const d = driver()
    d.tapButton('scene1').tapButton('stomp1').tapButton('stomp2')
    expect(d.state.activeScene).toBe(0)
    expect(d.state.stomps).toEqual([true, true])
    d.tapButton('preset3')
    expect(d.state.activeScene).toBeNull()
    expect(d.state.stomps).toEqual([false, false])
  })
})

describe('banks', () => {
  it('holding P3 goes to the next bank without sending MIDI', () => {
    const d = driver()
    d.press('preset3').wait(449)
    expect(d.state.displayedBank).toBe(0)
    d.wait(1)
    expect(d.state.displayedBank).toBe(1)
    d.release('preset3')
    expect(d.flush()).toEqual([])
    expect(d.state.loadedPreset).toBe(0)
  })

  it('holding P1 goes to the previous bank', () => {
    const d = driver()
    d.hold('preset3').hold('preset3').hold('preset1')
    expect(d.state.displayedBank).toBe(1)
    expect(d.flush()).toEqual([])
  })

  it('holding P2 does nothing and does not load on release', () => {
    const d = driver()
    d.hold('preset2')
    expect(d.flush()).toEqual([])
    expect(d.state.displayedBank).toBe(0)
    expect(d.state.loadedPreset).toBe(0)
  })

  it('fires once per hold (no auto-repeat)', () => {
    const d = driver()
    d.hold('preset3', 3000)
    expect(d.state.displayedBank).toBe(1)
  })

  it('wraps B01 <-> B17', () => {
    const d = driver()
    d.hold('preset1')
    expect(d.state.displayedBank).toBe(16)
    d.hold('preset3')
    expect(d.state.displayedBank).toBe(0)
  })

  it('detects the hold on release even without a tick in between', () => {
    let r = step(initialState(), { type: 'press', id: 'preset3', nowMs: 0 })
    r = step(r.state, { type: 'release', id: 'preset3', nowMs: 600 })
    expect(r.out).toEqual([])
    expect(r.state.displayedBank).toBe(1)
  })
})

describe('stomps', () => {
  it('toggles on press and always sends 127', () => {
    const d = driver()
    d.press('stomp1')
    expect(d.flush()).toEqual([{ cc: STOMP_CC[0], value: 127 }])
    expect(d.state.stomps).toEqual([true, false])
    d.release('stomp1').press('stomp1')
    expect(d.flush()).toEqual([{ cc: STOMP_CC[0], value: 127 }])
    expect(d.state.stomps).toEqual([false, false])
    d.release('stomp1').tapButton('stomp2')
    expect(d.flush()).toEqual([{ cc: STOMP_CC[1], value: 127 }])
    expect(d.state.stomps).toEqual([false, true])
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

  it('realigns the beat phase on every tap', () => {
    const d = driver()
    d.at(1234).press('tap')
    expect(d.state.beatAnchorMs).toBe(1234)
  })
})

describe('freeze', () => {
  it('holding Tap turns freeze on at 450 ms and off on release', () => {
    const d = driver()
    d.at(1000).press('tap')
    expect(d.flush()).toEqual([{ cc: TAP_CC, value: 127 }])
    d.wait(449)
    expect(d.flush()).toEqual([])
    d.wait(1)
    expect(d.flush()).toEqual([{ cc: FREEZE_CC, value: 127 }])
    expect(d.state.freeze).toBe(true)
    d.wait(2000).release('tap')
    expect(d.flush()).toEqual([{ cc: FREEZE_CC, value: 0 }])
    expect(d.state.freeze).toBe(false)
  })

  it('a short tap does not freeze', () => {
    const d = driver()
    d.tapButton('tap', 449)
    expect(d.flush()).toEqual([{ cc: TAP_CC, value: 127 }])
    expect(d.state.freeze).toBe(false)
  })
})
