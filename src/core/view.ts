// What the hardware shows: LED states and the screen model.
// The firmware draws the same model with U8g2.

import { SLOTS_PER_BANK, TAP_FLASH_MS } from './config'
import { beatPeriodMs } from './tapTempo'
import type { ButtonId, ControllerState } from './types'

export type Leds = Record<ButtonId, boolean>

export interface ScreenModel {
  bpmText: string
  /** FRZ tag is always shown; drawn inverted when active. */
  frzActive: boolean
  bankText: string
  /** Bank changed but no preset loaded from it yet: drawn inverted. */
  bankPending: boolean
  presetText: string
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function isBankPending(s: ControllerState): boolean {
  return s.displayedBank !== Math.floor(s.loadedPreset / SLOTS_PER_BANK)
}

export function isTapLedOn(s: ControllerState): boolean {
  if (s.freeze) return true
  const elapsed = s.nowMs - s.beatAnchorMs
  if (elapsed < 0) return false
  return elapsed % beatPeriodMs(s.bpm) < TAP_FLASH_MS
}

export function getLeds(s: ControllerState): Leds {
  const slotLit = isBankPending(s) ? -1 : s.loadedPreset % SLOTS_PER_BANK
  return {
    stomp1: s.stomps[0],
    stomp2: s.stomps[1],
    scene1: s.activeScene === 0,
    scene2: s.activeScene === 1,
    preset1: slotLit === 0,
    preset2: slotLit === 1,
    preset3: slotLit === 2,
    tap: isTapLedOn(s),
  }
}

export function getScreen(s: ControllerState): ScreenModel {
  return {
    bpmText: `${s.bpm} BPM`,
    frzActive: s.freeze,
    bankText: `B${pad2(s.displayedBank + 1)}`,
    bankPending: isBankPending(s),
    presetText: `P${pad2(s.loadedPreset + 1)}`,
  }
}
