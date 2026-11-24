# Pocket Master MIDI Controller

A foot controller for the Sonicake Pocket Master running the [**Pocket Master CFW**](https://pocketmaster-cfw.guitar-training-generator.com/): 8 footswitches, one LED each, and a 128×64 OLED screen.

This repo is **phase 1**: a web simulation of the controller that sends real MIDI to the pedal. **Phase 2** is ESP32 firmware with the same behavior, so all the rules live in a pure state machine (`src/core/`) meant to be ported as-is.

**[Open the simulator →](https://hitaloose.github.io/pm-cfw-midi-controller/)** (Chrome or Edge, desktop)

## Layout

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **Top** | Stomp 1 | Stomp 2 | Scene 1 | Scene 2 |
| **Bottom** | Preset 1 | Preset 2 | Preset 3 | Tap |

| Button | Press | Hold (≥ 450 ms) |
|---|---|---|
| Stomp 1 / 2 | toggles the STOMP FS1 / FS2 group | — |
| Scene 1 / 2 | activates the scene; pressing the active scene turns it off (back to the base preset) | — |
| Preset 1 / 2 / 3 | loads that slot of the displayed bank (on release) | P1: bank −, P3: bank +, P2: nothing |
| Tap | tap tempo | freeze while held |

- **Banks are the controller's own**: 3 presets per bank, 50 user presets → 17 banks (B17 holds only P49 and P50). Changing bank doesn't load anything: the bank stays *pending* (shown inverted on screen) until you press a preset.
- **Screen**: BPM and FRZ on top, bank and loaded preset below. Scenes, stomps and the active slot are shown by the LEDs.
- **Tap LED** flashes for 60 ms on every beat, realigned on each tap. BPM is the average of the last 4 taps (taps more than 2 s apart start over), 40–260 BPM.
- **Keyboard**: `1 2 3 4` for the top row, `Q W E R` for the bottom row. Holding a key is a long press.

## MIDI

Pedal settings: MIDI map **Stock**, MIDI channel **ALL** (or the one you pick in the app) and **same preset again OFF**.

| Function | Message |
|---|---|
| Load preset | CC 1 = preset number (P01 = 1) |
| Stomp FS1 / FS2 | CC 71 / 72 = 127 (always 127: the CFW only reacts to ≥ 64) |
| Scene 1 / 2 | CC 82 / 83 = 127 |
| Scene off | CC 85 = 127 |
| Tap | CC 26 = 127 |
| Freeze on / off | CC 114 = 127 / 0 |

Some of these are still being confirmed on the pedal. All of them live in [`src/core/midiMap.ts`](src/core/midiMap.ts).

The CFW has no MIDI out yet, so the controller can't read the pedal's state: if you change things on the pedal itself, the controller won't know.

### Connecting

- **Bluetooth**: click **Connect…** and pick the Pocket Master. No pairing in the OS needed. If the pedal is connected to your computer's Bluetooth MIDI setup (macOS: Audio MIDI Setup), disconnect it there first: it accepts one connection at a time. When connected, Bluetooth is used instead of USB.
- **USB** (or BLE paired in the OS): pick the port under **Output**.

Without any output, messages still show up in the **MIDI out** log, so you can try it without the pedal.

## Install on a tablet

It's a PWA: install it once and it opens full screen, works offline (after the first visit) and keeps the screen on while open.

- **Android** (Chrome): open the link → ⋮ menu → **Add to home screen** / **Install app**. Web MIDI and Web Bluetooth both work, so you can connect to the pedal by Bluetooth or USB-C (OTG).
- **iPad / iPhone**: you can add it to the home screen from Safari's Share menu, but **it can't send MIDI**: iOS browsers have no Web MIDI or Web Bluetooth.

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest
npm run build    # static site in dist/
```

Pushing to `main` runs the tests, builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Structure

```
src/
  core/   pure state machine: step(state, press | release | tick) → new state + CC messages.
          No React, no MIDI, no clock (time comes in as nowMs). This is what goes to the ESP32.
  midi/   outputs: Web MIDI (USB) and BLE MIDI over Web Bluetooth, plus byte encoding
  ui/     OLED canvas, footswitches, MIDI log
```

## Stack

[React](https://react.dev/) · TypeScript · [Vite](https://vite.dev/) · [Vitest](https://vitest.dev/) · [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) · [Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)

## Target hardware (phase 2)

ESP32 (S3 if USB host is needed) as a BLE MIDI client, SSD1306 0.96″ or SH1106 1.3″ OLED with U8g2, 8 footswitches with LEDs, and later an expression pedal jack (CC 16).
