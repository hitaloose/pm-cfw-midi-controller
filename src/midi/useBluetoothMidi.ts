// BLE MIDI straight from the browser (Web Bluetooth): no pairing in the OS needed.
// Ported from universal-midi-controller (hooks/useBluetoothMidi.ts).
//
// Pocket Master quirk: right after the GATT connect it drops the link while it
// renegotiates connection parameters, then comes back. A fixed retry loop misses
// that window, so we reconnect *reactively* on each `gattserverdisconnected`.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CcMessage } from '../core/midiMap'
import { BLE_MIDI_CHARACTERISTIC, BLE_MIDI_SERVICE, blePackets } from './blePacket'
import { ccBytes } from './ccBytes'

export type BleStatus = 'unsupported' | 'idle' | 'connecting' | 'connected' | 'reconnecting'

const LAST_DEVICE_KEY = 'pm-midi.bleDevice'
const CONNECT_ATTEMPTS = 6
const RETRY_DELAY_MS = 500

const log = (...args: unknown[]) => console.info('[BLE MIDI]', ...args)

/** Connects to the device's MIDI characteristic, riding out the drop-and-return. */
function connectCharacteristic(dev: BluetoothDevice): Promise<BluetoothRemoteGATTCharacteristic> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    let settled = false

    const finish = () => {
      settled = true
      dev.removeEventListener('gattserverdisconnected', onDisconnect)
    }

    const tryConnect = async () => {
      if (settled) return
      attempts++
      try {
        const server = await dev.gatt!.connect()
        const service = await server.getPrimaryService(BLE_MIDI_SERVICE)
        const char = await service.getCharacteristic(BLE_MIDI_CHARACTERISTIC)
        // Notifications are how BLE MIDI devices send MIDI back (future CFW MIDI out).
        await char.startNotifications()
        log(`connected on attempt ${attempts}`)
        finish()
        resolve(char)
      } catch (e) {
        log(`attempt ${attempts} failed`, e)
        if (attempts >= CONNECT_ATTEMPTS) {
          finish()
          reject(e)
        } else if (dev.gatt?.connected) {
          // Failed without a disconnect: no event will come, so retry ourselves.
          setTimeout(tryConnect, RETRY_DELAY_MS)
        }
        // Otherwise `gattserverdisconnected` fires and schedules the next attempt.
      }
    }

    const onDisconnect = () => {
      if (!settled) setTimeout(tryConnect, RETRY_DELAY_MS)
    }

    dev.addEventListener('gattserverdisconnected', onDisconnect)
    tryConnect()
  })
}

export function useBluetoothMidi() {
  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator
  const [status, setStatus] = useState<BleStatus>(supported ? 'idle' : 'unsupported')
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const deviceRef = useRef<BluetoothDevice | null>(null)
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const userDisconnect = useRef(false)
  // GATT allows one operation at a time: writes go through this queue.
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  const attach = useCallback(async (dev: BluetoothDevice, reconnecting = false) => {
    setStatus(reconnecting ? 'reconnecting' : 'connecting')
    setError(null)
    try {
      const char = await connectCharacteristic(dev)
      deviceRef.current = dev
      charRef.current = char
      setDeviceName(dev.name ?? 'Bluetooth device')
      setStatus('connected')
      localStorage.setItem(LAST_DEVICE_KEY, dev.id)
    } catch (e) {
      charRef.current = null
      setStatus('idle')
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // Link lost after a successful connect: try to get it back unless the user asked to leave.
  const onLinkLost = useCallback(
    (ev: Event) => {
      const dev = ev.target as BluetoothDevice
      if (dev !== deviceRef.current || charRef.current === null) return
      charRef.current = null
      if (userDisconnect.current) {
        userDisconnect.current = false
        deviceRef.current = null
        setDeviceName(null)
        setStatus('idle')
        return
      }
      log('link lost, reconnecting')
      attach(dev, true)
    },
    [attach],
  )

  const watch = useCallback(
    (dev: BluetoothDevice) => {
      dev.removeEventListener('gattserverdisconnected', onLinkLost)
      dev.addEventListener('gattserverdisconnected', onLinkLost)
    },
    [onLinkLost],
  )

  const connect = useCallback(async () => {
    if (!supported) return
    let dev: BluetoothDevice
    try {
      dev = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_MIDI_SERVICE] }],
        optionalServices: [BLE_MIDI_SERVICE],
      })
    } catch (e) {
      // NotFoundError = the user closed the chooser.
      if (!(e instanceof DOMException && e.name === 'NotFoundError')) {
        setError(e instanceof Error ? e.message : String(e))
      }
      return
    }
    watch(dev)
    await attach(dev)
  }, [supported, attach, watch])

  const disconnect = useCallback(() => {
    const dev = deviceRef.current
    if (!dev) return
    userDisconnect.current = true
    dev.gatt?.disconnect() // onLinkLost finishes the cleanup
  }, [])

  // Reconnect to the last device without a click. getDevices() only exists with
  // Chrome's new Web Bluetooth permissions backend; without it this is a no-op.
  useEffect(() => {
    if (!supported) return
    const lastId = localStorage.getItem(LAST_DEVICE_KEY)
    if (!lastId || !navigator.bluetooth.getDevices) return
    let cancelled = false
    navigator.bluetooth
      .getDevices()
      .then((devices) => {
        const dev = devices.find((d) => d.id === lastId)
        if (!dev || cancelled || deviceRef.current) return
        log('auto-connecting to', dev.name)
        watch(dev)
        attach(dev)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [supported, attach, watch])

  /** Sends the messages; returns false when not connected. */
  const send = useCallback((msgs: CcMessage[], channel: number): boolean => {
    const char = charRef.current
    if (!char) return false
    const packets = blePackets(
      msgs.map((m) => ccBytes(m, channel)),
      performance.now(),
    )
    for (const p of packets) {
      writeQueue.current = writeQueue.current
        .then(() => char.writeValueWithoutResponse(new Uint8Array(p)))
        .catch((e) => log('write failed', e))
    }
    return true
  }, [])

  return { status, deviceName, error, connect, disconnect, send }
}
