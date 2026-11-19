"use client";

// Menggantikan root layout saat layout itu sendiri gagal, jadi tidak memakai CSS global.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f2f1fa",
          color: "#15141f",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <title>Terjadi kesalahan · Portal Magang</title>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Terjadi kesalahan</h1>
          <p style={{ color: "#7a7891", fontSize: 14 }}>Portal gagal dimuat. Coba lagi beberapa saat.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              border: 0,
              borderRadius: 999,
              padding: "10px 20px",
              background: "#15141f",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
