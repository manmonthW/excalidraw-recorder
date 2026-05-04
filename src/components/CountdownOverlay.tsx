interface CountdownOverlayProps {
  count: number;
}

export function CountdownOverlay({ count }: CountdownOverlayProps) {
  return (
    <div style={styles.overlay}>
      <div key={count} style={styles.number}>
        {count}
      </div>
      <style>{`
        @keyframes countdownPop {
          0% { transform: scale(1.6); opacity: 0; }
          30% { transform: scale(1); opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.45)",
    zIndex: 3000,
    pointerEvents: "none",
  },
  number: {
    fontSize: 140,
    fontWeight: 800,
    color: "#fff",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    textShadow: "0 4px 24px rgba(0,0,0,0.5)",
    animation: "countdownPop 1s ease-out forwards",
    userSelect: "none",
  },
};
