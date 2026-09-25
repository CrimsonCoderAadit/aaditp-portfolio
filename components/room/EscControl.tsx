"use client";

import { createPortal } from "react-dom";
import "./esc-control.css";

/** The one way out, the same everywhere a game or close-up takes the screen:
 * top right, naming what Escape does right now, and a button in its own right.
 * Touch screens drop the key and keep the word. Rendered on the body, so no
 * transformed ancestor can pull it out of the corner. */
export default function EscControl({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return createPortal(
    <button type="button" className="esc-control" onClick={onPress} disabled={disabled} aria-label={`${label} (Escape)`}>
      <kbd aria-hidden="true">ESC</kbd><span>{label}</span>
    </button>,
    document.body,
  );
}
