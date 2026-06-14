export type DebouncedFn<T extends (...args: never[]) => void> = T & {
  cancel: () => void;
  flush: () => void;
};

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number
): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const callArgs = lastArgs;
      lastArgs = null;
      if (callArgs) fn(...callArgs);
    }, waitMs);
  }) as DebouncedFn<T>;

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  debounced.flush = () => {
    if (!timer || !lastArgs) return;
    clearTimeout(timer);
    timer = null;
    const callArgs = lastArgs;
    lastArgs = null;
    fn(...callArgs);
  };

  return debounced;
}

export type ThrottledFn<T extends (...args: never[]) => void> = T & {
  cancel: () => void;
};

export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number,
  opts: { leading?: boolean; trailing?: boolean } = {}
): ThrottledFn<T> {
  const leading = opts.leading !== false;
  const trailing = opts.trailing !== false;
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const invoke = (args: Parameters<T>) => {
    lastCall = Date.now();
    fn(...args);
  };

  const throttled = ((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = waitMs - (now - lastCall);
    lastArgs = args;

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (leading || lastCall === 0) invoke(args);
      else lastCall = now;
      return;
    }

    if (!timer && trailing) {
      timer = setTimeout(() => {
        timer = null;
        if (!leading) lastCall = 0;
        const callArgs = lastArgs;
        lastArgs = null;
        if (callArgs) invoke(callArgs);
      }, remaining);
    }
  }) as ThrottledFn<T>;

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return throttled;
}
