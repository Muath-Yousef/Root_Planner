import { useEffect, useRef, type RefObject } from 'react';

// Stack of open modals to ensure Escape closes only the topmost modal
const modalStack: { id: string; close: () => void }[] = [];

// Track the element focused before any modal opened
let lastOutsideFocusElement: HTMLElement | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener(
    'focus',
    (e) => {
      if (
        e.target instanceof HTMLElement &&
        !e.target.closest('[role="dialog"], [aria-modal="true"]')
      ) {
        lastOutsideFocusElement = e.target;
      }
    },
    true
  );
  window.addEventListener(
    'keydown',
    () => {
      if (
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement &&
        !document.activeElement.closest('[role="dialog"], [aria-modal="true"]')
      ) {
        lastOutsideFocusElement = document.activeElement;
      }
    },
    true
  );
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.target instanceof HTMLElement) {
        const btn =
          (e.target.closest('button, [tabindex], input, select, textarea') as HTMLElement) ||
          e.target;
        if (!btn.closest('[role="dialog"], [aria-modal="true"]')) {
          lastOutsideFocusElement = btn;
        }
      }
    },
    true
  );
}

export function clearModalStack(): void {
  modalStack.length = 0;
  lastOutsideFocusElement = null;
}

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]):not([hidden]):not([aria-hidden="true"]), ' +
  '[href]:not([hidden]):not([aria-hidden="true"]), ' +
  'input:not([type="hidden"]):not([disabled]):not([hidden]):not([aria-hidden="true"]), ' +
  'select:not([disabled]):not([hidden]):not([aria-hidden="true"]), ' +
  'textarea:not([disabled]):not([hidden]):not([aria-hidden="true"]), ' +
  '[tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden]):not([aria-hidden="true"])';

export interface UseModalA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  dialogRef?: RefObject<HTMLElement | null>;
  trapFocus?: boolean;
}

export function useModalA11y<T extends HTMLElement = HTMLElement>(
  isOpenOrOptions: boolean | UseModalA11yOptions,
  onCloseArg?: () => void,
  options?: { trapFocus?: boolean }
): RefObject<T | null> {
  const internalRef = useRef<T | null>(null);

  let isOpen: boolean;
  let onClose: () => void;
  let targetRef: RefObject<HTMLElement | null>;
  let trapFocus = true;

  if (typeof isOpenOrOptions === 'object' && isOpenOrOptions !== null) {
    isOpen = isOpenOrOptions.isOpen;
    onClose = isOpenOrOptions.onClose;
    targetRef = (isOpenOrOptions.dialogRef as RefObject<HTMLElement | null>) ?? internalRef;
    trapFocus = isOpenOrOptions.trapFocus ?? true;
  } else {
    isOpen = !!isOpenOrOptions;
    onClose = onCloseArg || (() => {});
    targetRef = internalRef;
    if (options?.trapFocus !== undefined) {
      trapFocus = options.trapFocus;
    }
  }

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const targetRefRef = useRef(targetRef);
  targetRefRef.current = targetRef;

  const previousActiveElement = useRef<HTMLElement | null>(null);
  const modalIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const modalId = modalIdRef.current;
    const isNewOpen = !wasOpenRef.current;
    wasOpenRef.current = true;

    // Capture the trigger element before opening
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      const container = targetRefRef.current.current;
      if (!container || !container.contains(document.activeElement)) {
        previousActiveElement.current = document.activeElement;
        lastOutsideFocusElement = document.activeElement;
      }
    }

    modalStack.push({ id: modalId, close: () => onCloseRef.current() });

    // Move focus inside dialog only on fresh open transition
    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    if (isNewOpen) {
      focusTimer = setTimeout(() => {
        const container = targetRefRef.current.current;
        if (container) {
          // If focus is already inside the container (e.g. user focused or typed), do NOT steal focus!
          if (
            document.activeElement &&
            container.contains(document.activeElement) &&
            document.activeElement !== container
          ) {
            return;
          }
          const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
          if (focusables.length > 0) {
            focusables[0].focus();
          } else {
            container.focus();
          }
        }
      }, 0);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes only the topmost modal
      if (e.key === 'Escape') {
        const top = modalStack[modalStack.length - 1];
        if (top && top.id === modalId) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      // Tab trap
      if (e.key === 'Tab' && trapFocus && targetRefRef.current.current) {
        const container = targetRefRef.current.current;
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      if (focusTimer) clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown, true);

      const idx = modalStack.findIndex((m) => m.id === modalId);
      if (idx !== -1) {
        modalStack.splice(idx, 1);
      }

      // Restore focus to opener element upon actual close
      if (modalStack.length === 0) {
        const toFocus = lastOutsideFocusElement || previousActiveElement.current;
        lastOutsideFocusElement = null;
        if (toFocus && typeof toFocus.focus === 'function') {
          setTimeout(() => toFocus.focus(), 0);
        }
      } else {
        const toFocus = previousActiveElement.current;
        if (toFocus && typeof toFocus.focus === 'function') {
          setTimeout(() => toFocus.focus(), 0);
        }
      }
    };
  }, [isOpen, trapFocus]);

  return targetRef as RefObject<T | null>;
}
