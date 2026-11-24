import type { CcMessage } from '../core/midiMap'

/** Raw bytes of a Control Change. `channel` is 1–16. */
export function ccBytes({ cc, value }: CcMessage, channel: number): [number, number, number] {
  if (!Number.isInteger(channel) || channel < 1 || channel > 16) throw new RangeError(`bad channel ${channel}`)
  if (!Number.isInteger(cc) || cc < 0 || cc > 127) throw new RangeError(`bad cc ${cc}`)
  if (!Number.isInteger(value) || value < 0 || value > 127) throw new RangeError(`bad value ${value}`)
  return [0xb0 | (channel - 1), cc, value]
}
