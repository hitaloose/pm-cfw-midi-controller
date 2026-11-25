// The 4-digit 7-segment display (TM1637). The model is the 4 segment bytes the
// chip receives, left to right, so the firmware passes them straight to
// TM1637Display::setSegments().
//
//    aaa
//   f   b      bit 0 = a … bit 6 = g, bit 7 = dp / colon
//    ggg
//   e   c
//    ddd

import type { ControllerState } from './types'

export const DIGIT_COUNT = 4
export const SEG_BLANK = 0x00
/** "F" (a, e, f, g): first digit while freeze is on. */
export const SEG_F = 0x71
export const DIGIT_SEGMENTS: readonly number[] = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f]

export type DisplaySegments = readonly number[]

/** BPM right-aligned, no leading zeros, in the last 3 digits (max 260). First digit: F while freeze is on. */
export function getDisplay(s: ControllerState): DisplaySegments {
  const text = String(s.bpm).slice(-(DIGIT_COUNT - 1)).padStart(DIGIT_COUNT - 1, ' ')
  const bpm = [...text].map((ch) => (ch === ' ' ? SEG_BLANK : DIGIT_SEGMENTS[Number(ch)]))
  return [s.freeze ? SEG_F : SEG_BLANK, ...bpm]
}
