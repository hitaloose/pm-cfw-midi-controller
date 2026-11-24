// The controller's whole business logic: a pure state machine.
// Events in (press / release / tick with nowMs), new state + CC messages out.
// No React, no MIDI, no clock: this is the part that gets ported to the firmware.

import { BANK_COUNT, DEFAULT_BPM, HOLD_MS, PRESET_COUNT, SLOTS_PER_BANK } from './config'
import {
  FREEZE_CC,
  MIDI_OFF,
  MIDI_ON,
  PRESET_INDEX_OFFSET,
  PRESET_LOAD_CC,
  SCENE_CC,
  SCENE_OFF,
  STOMP_CC,
  TAP_CC,
  type CcMessage,
} from './midiMap'
import { addTap, bpmFromTaps } from './tapTempo'
import { BUTTON_IDS, type ButtonId, type ButtonState, type ControllerEvent, type ControllerState, type StepResult } from './types'

const UP: ButtonState = { pressedAtMs: null, holdFired: false }

export function initialState(): ControllerState {
  const buttons = {} as Record<ButtonId, ButtonState>
  for (const id of BUTTON_IDS) buttons[id] = UP
  return {
    nowMs: 0,
    displayedBank: 0,
    loadedPreset: 0,
    activeScene: null,
    stomps: [false, false],
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

// ---------------------------------------------------------------- press

function onPress(s: ControllerState, id: ButtonId, out: CcMessage[]): ControllerState {
  if (s.buttons[id].pressedAtMs !== null) return s // already down (key repeat)
  s = setButton(s, id, { pressedAtMs: s.nowMs, holdFired: false })

  switch (id) {
    case 'stomp1':
    case 'stomp2': {
      const i = id === 'stomp1' ? 0 : 1
      const stomps: [boolean, boolean] = [s.stomps[0], s.stomps[1]]
      stomps[i] = !stomps[i]
      out.push({ cc: STOMP_CC[i], value: MIDI_ON })
      return { ...s, stomps }
    }
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
    case 'tap': {
      out.push({ cc: TAP_CC, value: MIDI_ON })
      const tapTimes = addTap(s.tapTimes, s.nowMs)
      return { ...s, tapTimes, bpm: bpmFromTaps(tapTimes) ?? s.bpm, beatAnchorMs: s.nowMs }
    }
    case 'preset1':
    case 'preset2':
    case 'preset3':
      return s // presets act on release (they also have a long press)
  }
}

// -------------------------------------------------------------- release

function onRelease(s: ControllerState, id: ButtonId, out: CcMessage[]): ControllerState {
  const button = s.buttons[id]
  if (button.pressedAtMs === null) return s
  s = setButton(s, id, UP)

  switch (id) {
    case 'preset1':
    case 'preset2':
    case 'preset3':
      return button.holdFired ? s : loadSlot(s, presetSlot(id), out)
    case 'tap':
      if (!s.freeze) return s
      out.push({ cc: FREEZE_CC, value: MIDI_OFF })
      return { ...s, freeze: false }
    default:
      return s
  }
}

// ----------------------------------------------------------------- hold

function fireHolds(s: ControllerState, out: CcMessage[]): ControllerState {
  for (const id of BUTTON_IDS) {
    const b = s.buttons[id]
    if (b.pressedAtMs === null || b.holdFired || s.nowMs - b.pressedAtMs < HOLD_MS) continue
    s = setButton(s, id, { ...b, holdFired: true })
    s = onHold(s, id, out)
  }
  return s
}

function onHold(s: ControllerState, id: ButtonId, out: CcMessage[]): ControllerState {
  switch (id) {
    case 'preset1':
      return { ...s, displayedBank: wrapBank(s.displayedBank - 1) }
    case 'preset3':
      return { ...s, displayedBank: wrapBank(s.displayedBank + 1) }
    case 'tap':
      out.push({ cc: FREEZE_CC, value: MIDI_ON })
      return { ...s, freeze: true }
    default:
      return s
  }
}

// -------------------------------------------------------------- helpers

function loadSlot(s: ControllerState, slot: number, out: CcMessage[]): ControllerState {
  const preset = s.displayedBank * SLOTS_PER_BANK + slot
  if (preset >= PRESET_COUNT) return s // e.g. slot 3 of B17
  out.push({ cc: PRESET_LOAD_CC, value: preset + PRESET_INDEX_OFFSET })
  return { ...s, loadedPreset: preset, activeScene: null, stomps: [false, false] }
}

function presetSlot(id: 'preset1' | 'preset2' | 'preset3'): number {
  return id === 'preset1' ? 0 : id === 'preset2' ? 1 : 2
}

function wrapBank(bank: number): number {
  return (bank + BANK_COUNT) % BANK_COUNT
}

function setButton(s: ControllerState, id: ButtonId, b: ButtonState): ControllerState {
  return { ...s, buttons: { ...s.buttons, [id]: b } }
}
