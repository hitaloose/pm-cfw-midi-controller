// Timing and layout rules of the controller (not MIDI numbers: see midiMap.ts).

export const HOLD_MS = 450

/** Two banks of 4: bank A = P01–P04, bank B = P05–P08. */
export const SLOTS_PER_BANK = 4
export const BANK_COUNT = 2

/** Bank B: the loaded preset's LED blinks with this period (half on, half off). */
export const BANK_B_BLINK_MS = 500

export const DEFAULT_BPM = 120
export const MIN_BPM = 40
export const MAX_BPM = 260
/** Taps further apart than this start a new measurement. */
export const TAP_TIMEOUT_MS = 2000
/** BPM is the average interval of the last N taps. */
export const TAP_HISTORY = 4
/** Tap LED is lit for this long at the start of each beat. */
export const TAP_FLASH_MS = 60
