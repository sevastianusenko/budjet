/** App icon: a flame on green paper. Rendered to PNG by next/og for the home screen. */
export function HearthMark({ size }: { size: number }) {
  const pad = size * 0.22;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1f5f4c",
        borderRadius: size * 0.22,
      }}
    >
      <svg width={size - pad * 2} height={size - pad * 2} viewBox="0 0 24 24" fill="none" stroke="#f2f5f2" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    </div>
  );
}
