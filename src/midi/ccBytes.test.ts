import { describe, expect, it } from 'vitest'
import { ccBytes } from './ccBytes'

describe('ccBytes', () => {
  it('builds a Control Change on the given channel (1–16)', () => {
    expect(ccBytes({ cc: 26, value: 127 }, 1)).toEqual([0xb0, 26, 127])
    expect(ccBytes({ cc: 1, value: 0 }, 16)).toEqual([0xbf, 1, 0])
  })

  it('rejects out-of-range values', () => {
    expect(() => ccBytes({ cc: 128, value: 0 }, 1)).toThrow()
    expect(() => ccBytes({ cc: 1, value: 128 }, 1)).toThrow()
    expect(() => ccBytes({ cc: 1, value: 0 }, 0)).toThrow()
  })
})
