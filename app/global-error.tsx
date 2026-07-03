"use client";

// Catches errors thrown by the root layout itself. This bypasses app/layout.tsx,
// so no font variable, globals.css, or Tailwind classes — inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ fontWeight: 600, fontSize: "1.125rem", margin: 0 }}>
            Something went wrong
          </p>
          <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: 8 }}>
            An unexpected error occurred while loading the app.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "0.5rem 1rem",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#0f172a",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
