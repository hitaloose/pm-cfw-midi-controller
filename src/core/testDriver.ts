// Test helper: drives the controller through a sequence of events.
import { initialState, step } from './controller'
import type { CcMessage } from './midiMap'
import type { ButtonId, ControllerState } from './types'

export function driver(start: ControllerState = initialState()) {
  let state = start
  let out: CcMessage[] = []
  let now = 0

  const apply = (r: { state: ControllerState; out: CcMessage[] }) => {
    state = r.state
    out.push(...r.out)
  }

  const api = {
    get state() {
      return state
    },
    /** Messages sent since the last flush(). */
    flush(): CcMessage[] {
      const sent = out
      out = []
      return sent
    },
    at(ms: number) {
      now = ms
      apply(step(state, { type: 'tick', nowMs: now }))
      return api
    },
    wait(ms: number) {
      return api.at(now + ms)
    },
    press(id: ButtonId) {
      apply(step(state, { type: 'press', id, nowMs: now }))
      return api
    },
    release(id: ButtonId) {
      apply(step(state, { type: 'release', id, nowMs: now }))
      return api
    },
    tapButton(id: ButtonId, holdMs = 50) {
      return api.press(id).wait(holdMs).release(id)
    },
    hold(id: ButtonId, holdMs = 500) {
      return api.press(id).wait(holdMs).release(id)
    },
  }
  return api
}
