import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  /** Giá trị đích. */
  value: number;
  /** Thời gian chạy (ms). */
  duration?: number;
}

/**
 * Số đếm động: đếm từ 0 lên giá trị đích khi hiển thị.
 * Tự động bỏ qua animation nếu user bật prefers-reduced-motion.
 */
export function CountUp({ value, duration = 1200 }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(eased * value));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{display}</>;
}
