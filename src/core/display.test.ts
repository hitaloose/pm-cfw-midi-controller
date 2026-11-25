import { describe, expect, it } from 'vitest'
import { DIGIT_SEGMENTS, getDisplay, SEG_BLANK, SEG_F } from './display'
import { driver } from './testDriver'

const [d0, d1, d2, , d4, , d6, , , d9] = DIGIT_SEGMENTS

describe('TM1637 display', () => {
  it('uses the standard TM1637 segment bytes (bit 0 = a … bit 6 = g)', () => {
    expect(DIGIT_SEGMENTS).toEqual([0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f])
  })

  it('shows the BPM right-aligned, leading digit blank', () => {
    expect(getDisplay(driver().state)).toEqual([SEG_BLANK, d1, d2, d0])
  })

  it('follows the tapped BPM, including 2 and 3 digits', () => {
    const d = driver()
    d.at(1000).tapButton('tap')
    d.at(2500).tapButton('tap') // 40 BPM
    expect(getDisplay(d.state)).toEqual([SEG_BLANK, SEG_BLANK, d4, d0])
    const f = driver()
    f.at(1000).tapButton('tap', 10)
    f.at(1100).tapButton('tap', 10) // clamped to 260
    expect(getDisplay(f.state)).toEqual([SEG_BLANK, d2, d6, d0])
    const n = driver()
    n.at(1000).tapButton('tap')
    n.at(1606).tapButton('tap') // 60000/606 = 99
    expect(getDisplay(n.state)).toEqual([SEG_BLANK, SEG_BLANK, d9, d9])
  })

  it('shows F in the first digit while freeze is on', () => {
    expect(SEG_F).toBe(0x71) // a, e, f, g
    const d = driver()
    d.at(1000).tapButton('tap')
    d.at(1250).tapButton('tap') // 240 BPM
    d.press('stomp1').wait(500)
    expect(getDisplay(d.state)).toEqual([SEG_F, d2, d4, d0])
    d.release('stomp1')
    expect(getDisplay(d.state)).toEqual([SEG_BLANK, d2, d4, d0])
  })
})
