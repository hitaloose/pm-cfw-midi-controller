import { describe, expect, it } from 'vitest'
import { blePackets } from './blePacket'

describe('blePackets', () => {
  it('wraps one message with header and timestamp (13-bit ms)', () => {
    // ts = 0x1234 & 0x1fff = 0x1234 → high 6 bits 0x24, low 7 bits 0x34
    expect(blePackets([[0xb0, 26, 127]], 0x1234)).toEqual([[0x80 | 0x24, 0x80 | 0x34, 0xb0, 26, 127]])
  })

  it('wraps the timestamp at 8192 ms', () => {
    expect(blePackets([[0xb0, 1, 1]], 8192 + 5)).toEqual([[0x80, 0x85, 0xb0, 1, 1]])
  })

  it('packs several messages in one packet, each with its timestamp byte', () => {
    expect(blePackets([[0xb0, 114, 0], [0xb0, 26, 127]], 0)).toEqual([
      [0x80, 0x80, 0xb0, 114, 0, 0x80, 0xb0, 26, 127],
    ])
  })

  it('splits into packets that fit the 20-byte default MTU payload', () => {
    const msgs = Array.from({ length: 6 }, (_, i) => [0xb0, i, 127])
    const packets = blePackets(msgs, 0)
    // a packet with n messages is 1 header + n × (timestamp + 3 bytes)
    expect(packets.map((p) => p.length)).toEqual([1 + 4 * 4, 1 + 4 * 2])
  })

  it('returns nothing for no messages', () => {
    expect(blePackets([], 0)).toEqual([])
  })
})
