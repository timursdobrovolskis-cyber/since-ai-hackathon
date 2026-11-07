"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/** App-wide smooth wheel scrolling. Touch stays native, and it switches off when the user asks for reduced motion. */
export function SmoothScroll() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;
    let frame = 0;

    const loop = (time: number) => {
      lenis?.raf(time);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (lenis || query.matches) return;
      // allowNestedScroll lets inner scroll areas such as the case list scroll themselves.
      lenis = new Lenis({ duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 3), allowNestedScroll: true });
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      lenis?.destroy();
      lenis = null;
    };
    const onChange = () => (query.matches ? stop() : start());

    start();
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
      stop();
    };
  }, []);

  return null;
}
