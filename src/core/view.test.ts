import { describe, expect, it } from 'vitest'
import { driver } from './testDriver'
import { getLeds, getScreen } from './view'

describe('screen', () => {
  it('shows BPM, FRZ, bank and preset', () => {
    const d = driver()
    expect(getScreen(d.state)).toEqual({
      bpmText: '120 BPM',
      frzActive: false,
      bankText: 'B01',
      bankPending: false,
      presetText: 'P01',
    })
  })

  it('bank is pending after a bank change until a preset is loaded', () => {
    const d = driver()
    d.hold('preset3')
    expect(getScreen(d.state)).toMatchObject({ bankText: 'B02', bankPending: true, presetText: 'P01' })
    d.tapButton('preset2')
    expect(getScreen(d.state)).toMatchObject({ bankText: 'B02', bankPending: false, presetText: 'P05' })
  })

  it('going back to the loaded bank clears pending', () => {
    const d = driver()
    d.hold('preset3').hold('preset1')
    expect(getScreen(d.state).bankPending).toBe(false)
  })

  it('FRZ is active while freezing', () => {
    const d = driver()
    d.press('tap').wait(500)
    expect(getScreen(d.state).frzActive).toBe(true)
  })
})

describe('leds', () => {
  it('stomp and scene LEDs follow their state', () => {
    const d = driver()
    d.tapButton('stomp2').tapButton('scene1')
    expect(getLeds(d.state)).toMatchObject({
      stomp1: false,
      stomp2: true,
      scene1: true,
      scene2: false,
    })
  })

  it('lights the loaded slot only when its bank is displayed', () => {
    const d = driver()
    d.tapButton('preset2')
    expect(getLeds(d.state)).toMatchObject({ preset1: false, preset2: true, preset3: false })
    d.hold('preset3')
    expect(getLeds(d.state)).toMatchObject({ preset1: false, preset2: false, preset3: false })
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

  it('tap LED is solid while freezing', () => {
    const d = driver()
    d.at(1000).press('tap').wait(500)
    for (let t = 1500; t < 2500; t += 37) {
      d.at(t)
      expect(getLeds(d.state).tap).toBe(true)
    }
  })
})
