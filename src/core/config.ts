// Timing and layout rules of the controller (not MIDI numbers: see midiMap.ts).

export const HOLD_MS = 450

export const PRESET_COUNT = 50
export const SLOTS_PER_BANK = 3
export const BANK_COUNT = Math.ceil(PRESET_COUNT / SLOTS_PER_BANK) // 17

export const DEFAULT_BPM = 120
export const MIN_BPM = 40
export const MAX_BPM = 260
/** Taps further apart than this start a new measurement. */
export const TAP_TIMEOUT_MS = 2000
/** BPM is the average interval of the last N taps. */
export const TAP_HISTORY = 4
/** Tap LED is lit for this long at the start of each beat. */
export const TAP_FLASH_MS = 60
