// Every MIDI number the controller sends lives here (CFW "Stock" map).
// Items marked TODO must be confirmed in the CFW MIDI monitor (Settings → MIDI)
// before trusting them. Change only this file after testing.

export interface CcMessage {
  cc: number
  value: number
}

export const MIDI_ON = 127
export const MIDI_OFF = 0

/** CC that loads a preset; value = preset index. */
export const PRESET_LOAD_CC = 1
/**
 * Value sent for P01. On the pedal CC 1 = 0 did nothing, so P01 = 1 (1-based).
 * TODO: confirm in the CFW MIDI monitor that CC 1 = 1 loads P01 and CC 1 = 8 loads P08.
 */
export const PRESET_INDEX_OFFSET = 1

/** Scene 1 / 2. TODO: confirm which CC maps to each scene. */
export const SCENE_CC = [82, 83] as const

/**
 * Message that returns to "no scene" (base preset sound).
 * TODO: confirm (candidate CC 85). Set to null if the CFW has no such message:
 * the controller then only clears its local scene state.
 */
export const SCENE_OFF: CcMessage | null = { cc: 85, value: MIDI_ON }

/** Tap tempo, sent as 127 on every tap. */
export const TAP_CC = 26

/** Freeze: momentary on Stomp FS1 hold, 127 = on (hold start), 0 = off (release). */
export const FREEZE_CC = 114

/** STOMP FS1 (stomp mode footswitch 1): each value ≥ 64 toggles the group. */
export const STOMP_FS1_CC = 80

/** Expression pedal A (future), continuous 0–127. */
export const EXP_A_CC = 16
