import { Logo } from "@/components/brand/Logo";

export default function TestLogoPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>בדיקת רכיב הלוגו</h1>
      <section>
        <h2>לוגו מלא (ברירת מחדל, מינימום 120px)</h2>
        <Logo variant="full" />
      </section>
      <section>
        <h2>לוגו שקוף כאייקון (מינימום 32px)</h2>
        <Logo variant="transparent" asIcon />
      </section>
      <section>
        <h2>לוגו מלא בגודל מותאם (200px)</h2>
        <Logo variant="full" size={200} />
      </section>
      <section>
        <h2>ניסיון גודל קטן מהמינימום (אמור להיאכף ל-120px)</h2>
        <Logo variant="full" size={50} />
      </section>
    </main>
  );
}
