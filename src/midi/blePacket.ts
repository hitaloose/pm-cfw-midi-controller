// BLE MIDI 1.0 packet encoding (pure, testable).
// Packet: [header][ts-low][midi bytes]([ts-low][midi bytes])...
//   header  = 0b10hhhhhh, h = timestamp bits 12–7
//   ts-low  = 0b1lllllll, l = timestamp bits 6–0 (13-bit ms clock)

export const BLE_MIDI_SERVICE = '03b80e5a-ede8-4b33-a751-6ce34ec4c700'
export const BLE_MIDI_CHARACTERISTIC = '7772e5db-3868-4112-a1a9-f2669d106bf3'

/** Payload of a write with the default ATT MTU (23 − 3). */
export const BLE_MAX_PACKET = 20

export function blePackets(messages: readonly (readonly number[])[], nowMs: number): number[][] {
  const ts = Math.floor(nowMs) & 0x1fff
  const header = 0x80 | ((ts >> 7) & 0x3f)
  const tsLow = 0x80 | (ts & 0x7f)

  const packets: number[][] = []
  let current: number[] = []
  for (const msg of messages) {
    if (current.length && current.length + 1 + msg.length > BLE_MAX_PACKET) {
      packets.push(current)
      current = []
    }
    if (!current.length) current.push(header)
    current.push(tsLow, ...msg)
  }
  if (current.length) packets.push(current)
  return packets
}
