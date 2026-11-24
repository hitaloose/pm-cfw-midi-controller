// What the hardware shows: one LED per footswitch. There is no screen.

import { BANK_B_BLINK_MS, TAP_FLASH_MS } from './config'
import { loadedBank, loadedSlot } from './controller'
import { beatPeriodMs } from './tapTempo'
import type { ButtonId, ControllerState } from './types'

export type Leds = Record<ButtonId, boolean>

export function isTapLedOn(s: ControllerState): boolean {
  const elapsed = s.nowMs - s.beatAnchorMs
  if (elapsed < 0) return false
  return elapsed % beatPeriodMs(s.bpm) < TAP_FLASH_MS
}

/** Loaded preset's LED: solid in bank A, blinking in bank B. */
function isPresetLedOn(s: ControllerState): boolean {
  return loadedBank(s) === 0 || s.nowMs % BANK_B_BLINK_MS < BANK_B_BLINK_MS / 2
}

export function getLeds(s: ControllerState): Leds {
  const lit = isPresetLedOn(s) ? loadedSlot(s) : -1
  return {
    preset1: lit === 0,
    preset2: lit === 1,
    preset3: lit === 2,
    preset4: lit === 3,
    scene1: s.activeScene === 0,
    scene2: s.activeScene === 1,
    freeze: s.freeze,
    tap: isTapLedOn(s),
  }
}
