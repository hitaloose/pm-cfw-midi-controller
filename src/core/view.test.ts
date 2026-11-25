import { describe, expect, it } from 'vitest'
import { driver } from './testDriver'
import { BANK_B_BLINK_MS } from './config'
import { getLeds } from './view'

describe('leds', () => {
  it('scene and stomp LEDs follow their state', () => {
    const d = driver()
    d.tapButton('scene1').tapButton('stomp1')
    expect(getLeds(d.state)).toMatchObject({ scene1: true, scene2: false, stomp1: true })
    d.tapButton('stomp1')
    expect(getLeds(d.state).stomp1).toBe(false)
  })

  it('bank A: the loaded preset LED is solid', () => {
    const d = driver()
    d.tapButton('preset2')
    for (let t = 100; t < 3000; t += 37) {
      d.at(t)
      expect(getLeds(d.state)).toMatchObject({ preset1: false, preset2: true, preset3: false, preset4: false })
    }
  })

  it('bank B: the loaded preset LED blinks (half on, half off)', () => {
    const d = driver()
    d.hold('preset3') // P07
    const half = BANK_B_BLINK_MS / 2
    const t0 = BANK_B_BLINK_MS * 10 // the blink runs on the absolute clock
    d.at(t0)
    expect(getLeds(d.state)).toMatchObject({ preset1: false, preset2: false, preset3: true, preset4: false })
    d.at(t0 + half - 1)
    expect(getLeds(d.state).preset3).toBe(true)
    d.at(t0 + half)
    expect(getLeds(d.state).preset3).toBe(false)
    d.at(t0 + BANK_B_BLINK_MS)
    expect(getLeds(d.state).preset3).toBe(true)
    expect(getLeds(d.state)).toMatchObject({ preset1: false, preset2: false, preset4: false })
  })

  it('tap LED flashes for 60 ms at the start of each beat', () => {
    const d = driver()
    d.at(1000).tapButton('tap', 10)
    d.at(1500).tapButton('tap', 10) // 120 BPM, anchor 1500
    d.at(1500 + 59)
    expect(getLeds(d.state).tap).toBe(true)
    d.at(1500 + 60)
    expect(getLeds(d.state).tap).toBe(false)
    d.at(1500 + 499)
    expect(getLeds(d.state).tap).toBe(false)
    d.at(1500 + 500)
    expect(getLeds(d.state).tap).toBe(true)
    d.at(1500 + 1030)
    expect(getLeds(d.state).tap).toBe(true)
  })

  it('a tap realigns the flash to the moment of the tap', () => {
    const d = driver()
    d.at(1000).tapButton('tap', 10)
    d.at(1500).tapButton('tap', 10)
    d.at(1800).press('tap') // off-beat tap
    expect(getLeds(d.state).tap).toBe(true)
    d.wait(10).release('tap')
    // new BPM from 500, 300 → 60000/400 = 150 → period 400 from 1800
    d.at(1800 + 100)
    expect(getLeds(d.state).tap).toBe(false)
    d.at(1800 + 400)
    expect(getLeds(d.state).tap).toBe(true)
  })

  it('freezing does not light the stomp LED nor touch the tap LED', () => {
    const d = driver()
    d.at(1000).tapButton('tap', 10)
    d.at(1500).tapButton('tap', 10) // 120 BPM, anchor 1500
    d.at(1510).press('stomp1').at(2000) // hold completes at 1960
    expect(d.state.freeze).toBe(true)
    expect(getLeds(d.state)).toMatchObject({ stomp1: false, tap: true })
    d.at(2100)
    expect(getLeds(d.state).tap).toBe(false)
  })
})
