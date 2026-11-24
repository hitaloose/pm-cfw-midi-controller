import type { ButtonId } from '../core/types'

export interface FootswitchProps {
  id: ButtonId
  label: string
  sub: string
  shortcut: string
  led: boolean
  ledColor: string
  down: boolean
  onPress: (id: ButtonId) => void
  onRelease: (id: ButtonId) => void
}

export function Footswitch({ id, label, sub, shortcut, led, ledColor, down, onPress, onRelease }: FootswitchProps) {
  return (
    <div className="fs">
      <span
        className="led"
        aria-hidden="true"
        style={led ? { background: ledColor, boxShadow: `0 0 10px 2px ${ledColor}88` } : undefined}
      />
      <span className="fs-label">{label}</span>
      <button
        type="button"
        className={down ? 'cap down' : 'cap'}
        aria-label={`${label} (key ${shortcut})`}
        aria-pressed={down}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          onPress(id)
        }}
        onPointerUp={() => onRelease(id)}
        onPointerCancel={() => onRelease(id)}
        onContextMenu={(e) => e.preventDefault()}
        // Keyboard on the focused button is handled by the global shortcuts.
        onKeyDown={(e) => e.key === ' ' || e.key === 'Enter' ? e.preventDefault() : undefined}
      />
      <span className="fs-sub">
        {sub}
        <kbd>{shortcut}</kbd>
      </span>
    </div>
  )
}
