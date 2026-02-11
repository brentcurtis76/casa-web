/**
 * useDebounce — Returns a debounced version of the provided value.
 *
 * The returned value only updates after `delay` milliseconds of inactivity
 * on the source value. Useful for search inputs to avoid firing requests
 * on every keystroke.
 */

import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
