"use client";

import { useEffect, useRef } from "react";

export default function SoccerBallCursor() {
  const ballRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ballRef.current;
    if (!el) return;

    document.body.classList.add("custom-cursor");

    function onMove(e: MouseEvent) {
      if (!el) return;
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      el.style.opacity = "1";
    }

    function onLeave() {
      if (el) el.style.opacity = "0";
    }

    function onEnter() {
      if (el) el.style.opacity = "1";
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    return () => {
      document.body.classList.remove("custom-cursor");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
    };
  }, []);

  return (
    <div
      ref={ballRef}
      style={{
        position: "fixed",
        left: -100,
        top: -100,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 99999,
        fontSize: 22,
        lineHeight: 1,
        opacity: 0,
        userSelect: "none",
        transition: "opacity 0.1s",
      }}
      aria-hidden
    >
      ⚽
    </div>
  );
}
