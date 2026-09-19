import { useEffect } from 'react';

interface HotkeyOptions {
  /** Require ⌘ on macOS / Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Fire even while an input is focused (default: true for mod combos, else false). */
  allowInInputs?: boolean;
  enabled?: boolean;
}

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
};

/** Binds a single global key combination, e.g. `useHotkey('k', open, { mod: true })`. */
export const useHotkey = (
  key: string,
  handler: () => void,
  { mod = false, shift = false, alt = false, allowInInputs, enabled = true }: HotkeyOptions = {}
) => {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const matchesMod = mod ? event.metaKey || event.ctrlKey : !event.metaKey && !event.ctrlKey;
      if (!matchesMod) return;
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (shift !== event.shiftKey) return;
      if (alt !== event.altKey) return;

      const inInput = isTypingTarget(event.target);
      const allowedInInput = allowInInputs ?? mod;
      if (inInput && !allowedInInput) return;

      event.preventDefault();
      handler();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [key, handler, mod, shift, alt, allowInInputs, enabled]);
};

export default useHotkey;
