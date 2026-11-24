// The controller's whole business logic: a pure state machine.
// Events in (press / release / tick with nowMs), new state + CC messages out.
// No React, no MIDI, no clock: this is the part that gets ported to the firmware.

import { BANK_COUNT, DEFAULT_BPM, HOLD_MS, SLOTS_PER_BANK } from './config'
import {
  FREEZE_CC,
  MIDI_OFF,
  MIDI_ON,
  PRESET_INDEX_OFFSET,
  PRESET_LOAD_CC,
  SCENE_CC,
  SCENE_OFF,
  TAP_CC,
  type CcMessage,
} from './midiMap'
import { addTap, bpmFromTaps } from './tapTempo'
import {
  BUTTON_IDS,
  type ButtonId,
  type ButtonState,
  type ControllerEvent,
  type ControllerState,
  type PresetButtonId,
  type StepResult,
} from './types'

const UP: ButtonState = { pressedAtMs: null, holdFired: false }

export function initialState(): ControllerState {
  const buttons = {} as Record<ButtonId, ButtonState>
  for (const id of BUTTON_IDS) buttons[id] = UP
  return {
    nowMs: 0,
    loadedPreset: 0,
    activeScene: null,
    freeze: false,
    bpm: DEFAULT_BPM,
    beatAnchorMs: 0,
    tapTimes: [],
    buttons,
  }
}

export function step(state: ControllerState, event: ControllerEvent): StepResult {
  const out: CcMessage[] = []
  // Time only moves forward; holds that matured before this event run first,
  // so a release that arrives late still counts as a long press.
  let s: ControllerState = { ...state, nowMs: Math.max(state.nowMs, event.nowMs) }
  s = fireHolds(s, out)

  switch (event.type) {
    case 'tick':
      break
    case 'press':
      s = onPress(s, event.id, out)
      break
    case 'release':
      s = onRelease(s, event.id, out)
      break
  }
  return { state: s, out }
}

/** Bank (0 = A, 1 = B) of the loaded preset. */
export function loadedBank(s: ControllerState): number {
  return Math.floor(s.loadedPreset / SLOTS_PER_BANK)
}

/** Button slot (0–3) of the loaded preset, the same in both banks. */
export function loadedSlot(s: ControllerState): number {
  return s.loadedPreset % SLOTS_PER_BANK
}

// ---------------------------------------------------------------- press

function onPress(s: ControllerState, id: ButtonId, out: CcMessage[]): ControllerState {
  if (s.buttons[id].pressedAtMs !== null) return s // already down (key repeat)
  s = setButton(s, id, { pressedAtMs: s.nowMs, holdFired: false })

  switch (id) {
    case 'scene1':
    case 'scene2': {
      const i = id === 'scene1' ? 0 : 1
      if (s.activeScene === i) {
        if (SCENE_OFF) out.push(SCENE_OFF)
        return { ...s, activeScene: null }
      }
      out.push({ cc: SCENE_CC[i], value: MIDI_ON })
      return { ...s, activeScene: i }
    }
    case 'freeze': {
      const freeze = !s.freeze
      out.push({ cc: FREEZE_CC, value: freeze ? MIDI_ON : MIDI_OFF })
      return { ...s, freeze }
    }
    case 'tap': {
      out.push({ cc: TAP_CC, value: MIDI_ON })
      const tapTimes = addTap(s.tapTimes, s.nowMs)
      return { ...s, tapTimes, bpm: bpmFromTaps(tapTimes) ?? s.bpm, beatAnchorMs: s.nowMs }
    }
    default:
      return s // presets act on release (they also have a long press)
  }
}

// -------------------------------------------------------------- release

function onRelease(s: ControllerState, id: ButtonId, out: CcMessage[]): ControllerState {
  const button = s.buttons[id]
  if (button.pressedAtMs === null) return s
  s = setButton(s, id, UP)

  if (isPreset(id) && !button.holdFired) return loadPreset(s, loadedBank(s), presetSlot(id), out)
  return s
}

// ----------------------------------------------------------------- hold

function fireHolds(s: ControllerState, out: CcMessage[]): ControllerState {
  for (const id of BUTTON_IDS) {
    const b = s.buttons[id]
    if (b.pressedAtMs === null || b.holdFired || s.nowMs - b.pressedAtMs < HOLD_MS) continue
    s = setButton(s, id, { ...b, holdFired: true })
    // Holding a preset loads that button's preset in the other bank.
    if (isPreset(id)) s = loadPreset(s, (loadedBank(s) + 1) % BANK_COUNT, presetSlot(id), out)
  }
  return s
}

// -------------------------------------------------------------- helpers

function loadPreset(s: ControllerState, bank: number, slot: number, out: CcMessage[]): ControllerState {
  const preset = bank * SLOTS_PER_BANK + slot
  out.push({ cc: PRESET_LOAD_CC, value: preset + PRESET_INDEX_OFFSET })
  return { ...s, loadedPreset: preset, activeScene: null }
}

function isPreset(id: ButtonId): id is PresetButtonId {
  return id === 'preset1' || id === 'preset2' || id === 'preset3' || id === 'preset4'
}

function presetSlot(id: PresetButtonId): number {
  return Number(id.slice(-1)) - 1
}

function setButton(s: ControllerState, id: ButtonId, b: ButtonState): ControllerState {
  return { ...s, buttons: { ...s.buttons, [id]: b } }
}
