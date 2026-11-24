import type { CcMessage } from './midiMap'

export type ButtonId =
  | 'preset1'
  | 'preset2'
  | 'preset3'
  | 'preset4'
  | 'scene1'
  | 'scene2'
  | 'freeze'
  | 'tap'

export type PresetButtonId = 'preset1' | 'preset2' | 'preset3' | 'preset4'

/** Top row, then bottom row. */
export const BUTTON_IDS: readonly ButtonId[] = [
  'preset1',
  'preset2',
  'preset3',
  'preset4',
  'scene1',
  'scene2',
  'freeze',
  'tap',
]

export type ControllerEvent =
  | { type: 'press'; id: ButtonId; nowMs: number }
  | { type: 'release'; id: ButtonId; nowMs: number }
  | { type: 'tick'; nowMs: number }

export interface ButtonState {
  /** null when the button is up. */
  pressedAtMs: number | null
  /** The long-press action already ran for the current press. */
  holdFired: boolean
}

export interface ControllerState {
  nowMs: number
  /** Loaded preset index, 0-based (P01 = 0). Its bank is loadedPreset / SLOTS_PER_BANK. */
  loadedPreset: number
  /** 0 = SC1, 1 = SC2, null = no scene. */
  activeScene: 0 | 1 | null
  freeze: boolean
  bpm: number
  /** Time of the beat the tap LED is aligned to. */
  beatAnchorMs: number
  /** Times of recent taps, oldest first, at most TAP_HISTORY entries. */
  tapTimes: readonly number[]
  buttons: Readonly<Record<ButtonId, ButtonState>>
}

export interface StepResult {
  state: ControllerState
  out: CcMessage[]
}
