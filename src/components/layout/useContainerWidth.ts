import { useEffect, useRef, useState } from 'react';

/** Custom hook to observe container element width for responsive JSX calculations */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number>(1200);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          setWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    const measured = el.getBoundingClientRect().width;
    if (measured > 0) {
      setWidth(measured);
    }

    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
