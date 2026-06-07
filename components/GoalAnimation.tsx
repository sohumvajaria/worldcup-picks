"use client";

import { useEffect } from "react";

interface Props {
  onComplete: () => void;
}

export default function GoalAnimation({ onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2200);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <>
      <style>{`
        @keyframes goalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes greenFlash {
          0%   { opacity: 0; }
          18%  { opacity: 0.18; }
          100% { opacity: 0; }
        }
        @keyframes ballFly {
          0%   { transform: translateX(-50%) translateY(55vh) scale(0.25); opacity: 0; }
          18%  { opacity: 1; }
          72%  { transform: translateX(-50%) translateY(0px) scale(1.35); }
          86%  { transform: translateX(-50%) translateY(6px)  scale(0.88); }
          100% { transform: translateX(-50%) translateY(0px) scale(1); }
        }
        @keyframes netShake {
          0%,100% { transform: translateX(0) rotate(0deg); }
          18%     { transform: translateX(-7px) rotate(-1deg); }
          36%     { transform: translateX(7px)  rotate(1deg); }
          54%     { transform: translateX(-4px) rotate(0deg); }
          72%     { transform: translateX(4px); }
        }
        @keyframes textPop {
          0%  { opacity: 0; transform: scale(0.4); }
          65% { transform: scale(1.08); }
          100%{ opacity: 1; transform: scale(1); }
        }
        @keyframes subPop {
          0%  { opacity: 0; transform: translateY(8px); }
          100%{ opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0, 0, 0, 0.93)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          animation: "goalFadeIn 0.18s ease forwards",
        }}
      >
        {/* Green flash */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--accent)",
            opacity: 0,
            pointerEvents: "none",
            animation: "greenFlash 0.7s ease 0.55s forwards",
          }}
        />

        {/* Goal net */}
        <div
          style={{
            position: "relative",
            width: 280,
            height: 180,
            borderTop: "5px solid #fff",
            borderLeft: "5px solid #fff",
            borderRight: "5px solid #fff",
            borderRadius: "6px 6px 0 0",
            backgroundImage: [
              "linear-gradient(rgba(255,255,255,0.11) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(255,255,255,0.11) 1px, transparent 1px)",
            ].join(","),
            backgroundSize: "23px 23px",
            animation: "netShake 0.45s ease 0.62s",
            boxShadow: "0 0 40px rgba(0,255,135,0.08), inset 0 0 30px rgba(0,0,0,0.4)",
          }}
        >
          {/* Ball — absolutely inside the net so translateY is relative to it */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "40%",
              fontSize: 52,
              lineHeight: 1,
              animation: "ballFly 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both",
              filter: "drop-shadow(0 0 16px rgba(0,255,135,0.4))",
            }}
          >
            ⚽
          </div>
        </div>

        {/* Ground bar */}
        <div
          style={{
            width: 290,
            height: 6,
            background: "rgba(255,255,255,0.15)",
            borderRadius: "0 0 4px 4px",
            marginBottom: 36,
          }}
        />

        {/* Text */}
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-bebas)",
              fontSize: 62,
              letterSpacing: "0.1em",
              color: "var(--accent)",
              lineHeight: 1,
              textShadow: "0 0 48px rgba(0,255,135,0.55), 0 0 80px rgba(0,255,135,0.2)",
              animation: "textPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.95s both",
            }}
          >
            PICKS LOCKED IN!
          </p>
          <p
            style={{
              fontSize: 13,
              color: "var(--muted)",
              marginTop: 10,
              letterSpacing: "0.05em",
              animation: "subPop 0.3s ease 1.35s both",
            }}
          >
            Redirecting to dashboard…
          </p>
        </div>
      </div>
    </>
  );
}
