/**
 * דף בדיקה זמני ל-Design Tokens (משימה 1.4 ב-PLAN.md).
 * מטרת הדף: לוודא ש-Tailwind utility classes מבוססות ה-tokens
 * (bg-gold, text-charcoal, bg-champagne, text-gold-dark, bg-success וכו')
 * קיימות ומתקמפלות בפועל ב-build.
 */
export default function TestTokensPage() {
  return (
    <main className="min-h-screen bg-champagne p-8">
      <h1 className="text-2xl font-semibold text-charcoal">בדיקת Design Tokens</h1>

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div data-token="gold" className="rounded-lg bg-gold p-4 text-ink">
          bg-gold
        </div>
        <div data-token="ink" className="rounded-lg bg-ink p-4 text-white">
          bg-ink
        </div>
        <div data-token="champagne" className="rounded-lg bg-champagne p-4 text-charcoal border">
          bg-champagne
        </div>
        <div data-token="gold-dark" className="rounded-lg bg-white p-4 text-gold-dark border">
          text-gold-dark
        </div>
        <div data-token="gold-light" className="rounded-lg bg-gold-light p-4 text-ink">
          bg-gold-light
        </div>
        <div data-token="charcoal" className="rounded-lg bg-white p-4 text-charcoal border">
          text-charcoal
        </div>
        <div data-token="taupe" className="rounded-lg bg-white p-4 text-taupe border">
          text-taupe
        </div>
        <div data-token="success" className="rounded-lg bg-success p-4 text-white">
          bg-success
        </div>
        <div data-token="error" className="rounded-lg bg-error p-4 text-white">
          bg-error
        </div>
        <div data-token="warning" className="rounded-lg bg-warning p-4 text-white">
          bg-warning
        </div>
      </section>
    </main>
  );
}
