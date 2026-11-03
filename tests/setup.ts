import 'fake-indexeddb/auto';

if (typeof window !== 'undefined') {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!window.DOMMatrixReadOnly) {
    // @ts-expect-error polyfill
    window.DOMMatrixReadOnly = class DOMMatrixReadOnly {
      m11 = 1; m12 = 0; m21 = 0; m22 = 1; m41 = 0; m42 = 0;
      constructor(init?: unknown) {
        if (Array.isArray(init)) {
          this.m11 = init[0] ?? 1;
          this.m12 = init[1] ?? 0;
          this.m21 = init[2] ?? 0;
          this.m22 = init[3] ?? 1;
          this.m41 = init[4] ?? 0;
          this.m42 = init[5] ?? 0;
        }
      }
      static fromMatrix() { return new DOMMatrixReadOnly(); }
      static fromFloat32Array() { return new DOMMatrixReadOnly(); }
      static fromFloat64Array() { return new DOMMatrixReadOnly(); }
      inverse() { return this; }
      multiply() { return this; }
      transformPoint(p: unknown) { return p; }
    };
  }

  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}
