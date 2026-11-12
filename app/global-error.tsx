"use client";

/**
 * Global error boundary — תופס שגיאות שעולות עד השורש (כולל שגיאות ב-layout של
 * קבוצת (admin), למשל כשל שליפת נתונים מ-Prisma). ללא קובץ זה, שגיאת שרת כזו
 * מציגה עמוד לבן ריק ללא כל מידע.
 *
 * global-error מחליף את ה-RootLayout כולו, ולכן חייב לרנדר <html>/<body> משלו,
 * ואינו יכול להסתמך על טעינת ה-CSS הגלובלי — לכן העיצוב כאן ב-inline styles.
 *
 * שם/קוד ה-digest מוצג כדי לאפשר איתור השגיאה בלוגים של Vercel. אין כאן PII.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#141210",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem", color: "#d9b55f" }}>
            אירעה שגיאה בטעינת העמוד
          </h1>
          <p style={{ lineHeight: 1.7, marginBottom: "1.5rem", color: "#e5e1da" }}>
            משהו השתבש בעת טעינת המערכת. נסו לרענן את העמוד. אם התקלה חוזרת, פנו
            לתמיכה הטכנית וציינו את קוד השגיאה שמטה.
          </p>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: "#d9b55f",
              color: "#141210",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.5rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              minHeight: "44px",
            }}
          >
            נסו שוב
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#9a948b" }}>
              קוד שגיאה: <code dir="ltr">{error.digest}</code>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
