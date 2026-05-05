"use client";
import { useEffect, useState, useRef, RefObject } from "react";

/* ============================================================
   MOTION HOOKS — Primitives TypeScript pour le motion design premium.
   Port depuis le dashboard admin IMPAKT.
   ============================================================ */

interface CountUpOptions { decimals?: number; enabled?: boolean }

export function useCountUp(target: number, duration = 900, options: CountUpOptions = {}): number {
  const { decimals = 0, enabled = true } = options;
  const [value, setValue] = useState<number>(enabled ? 0 : target);
  const rafRef = useRef<number | null>(null);
  const prevTargetRef = useRef<unknown>(Symbol('init'));
  const valueRef = useRef<number>(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) { setValue(target); valueRef.current = target; return; }
    if (typeof target !== 'number' || isNaN(target)) { setValue(0); valueRef.current = 0; return; }
    if (prevTargetRef.current === target) return;
    prevTargetRef.current = target;

    const startTime = performance.now();
    const startValue = valueRef.current;
    const delta = target - startValue;
    if (delta === 0) { setValue(target); valueRef.current = target; return; }

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + delta * eased;
      valueRef.current = current;
      setValue(current);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, enabled]);

  return decimals === 0
    ? Math.round(value)
    : Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

interface MousePosition { x: number; y: number; hovering: boolean }
export function useMousePosition(ref: RefObject<HTMLElement>): MousePosition {
  const [pos, setPos] = useState<MousePosition>({ x: -9999, y: -9999, hovering: false });
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, hovering: true });
    };
    const onLeave = () => setPos({ x: -9999, y: -9999, hovering: false });
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [ref]);
  return pos;
}

interface TiltOptions { max?: number; scale?: number; perspective?: number; reset?: boolean }
export function useTilt(ref: RefObject<HTMLElement>, options: TiltOptions = {}) {
  const { max = 6, scale = 1.01, perspective = 1000, reset = true } = options;
  const [transform, setTransform] = useState<string>('');
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const rotY = ((mx - cx) / cx) * max;
        const rotX = -((my - cy) / cy) * max;
        setTransform(`perspective(${perspective}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale(${scale})`);
      });
    };
    const onLeave = () => { if (reset) setTransform(''); };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ref, max, scale, perspective, reset]);
  return { transform, transition: transform ? 'transform .08s linear' : 'transform .4s cubic-bezier(0.2, 0.8, 0.2, 1)' };
}

interface MagneticOptions { strength?: number; radius?: number }
export function useMagnetic(ref: RefObject<HTMLElement>, options: MagneticOptions = {}) {
  const { strength = 0.25, radius = 80 } = options;
  const [translate, setTranslate] = useState<string>('translate(0, 0)');
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius) setTranslate(`translate(${dx * strength}px, ${dy * strength}px)`);
        else setTranslate('translate(0, 0)');
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ref, strength, radius]);
  return { transform: translate, transition: 'transform .2s cubic-bezier(0.2, 0.8, 0.2, 1)' };
}

export const staggerDelay = (index: number, base = 40, max = 12): string =>
  `${Math.min(index, max) * base}ms`;

export function startViewTransition(callback: () => void): void {
  const doc = typeof document !== 'undefined' ? (document as Document & { startViewTransition?: (cb: () => void) => unknown }) : null;
  if (doc?.startViewTransition) doc.startViewTransition(callback);
  else callback();
}

export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState<boolean>(
    typeof document === 'undefined' ? true : !document.hidden
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

export function useSmartInterval(callback: () => void, intervalMs: number | null, enabled = true): void {
  const savedCallback = useRef<() => void>(callback);
  const visible = usePageVisibility();
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (!enabled || !visible || !intervalMs) return;
    const tick = () => { try { savedCallback.current(); } catch { /* silent */ } };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled, visible]);
}
