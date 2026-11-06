// Placeholder page — the real appointment calendar (task 5.x) will replace this.
// Its purpose here is to make the auth gate from task 1.11 testable.
export default function CalendarPage() {
  return (
    <main dir="rtl" className="flex min-h-screen flex-col gap-4 bg-champagne p-6">
      <h1 className="font-heading text-2xl text-charcoal">יומן תורים</h1>
      <p className="text-taupe">
        מסך זה יוחלף ביומן התורים המלא (תחום 5 בתוכנית העבודה). כרגע הוא משמש
        לבדיקת חסימת הגישה למשתמש לא מחובר.
      </p>
    </main>
  );
}
