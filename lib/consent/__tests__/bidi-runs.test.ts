/**
 * @vitest-environment node
 *
 * בדיקות יחידה לסידור הדו-כיווני ב-PDF ההסכמה (lib/consent/pdf.ts):
 * - toVisualOrder: עברית הפוכה לציור LTR, ספרות/לטינית נשמרות, LRM מוסר ושומר תאריך+שעה יחד.
 * - splitVisualRuns: מקטע עברי מוחזר בסדר לוגי (לנטרול ההיפוך של fontkit), מקטע LTR כפי שהוא,
 *   והשרשור החזותי של המקטעים (אחרי היפוך מדומה של fontkit) שווה למחרוזת החזותית.
 *
 * רקע: fontkit הופך בעצמו את כל רצף הגליפים כשהסקריפט החזק הראשון הוא עברי — בלי הפיצול
 * העברית הופיעה הפוכה וספרות התאריך התהפכו (נמצא בבדיקה ויזואלית של PDF מהפרודקשן, 2026-11-13).
 *
 * הרצה: `npx vitest run lib/consent/__tests__/bidi-runs.test.ts`
 */

import { describe, it, expect } from 'vitest';
import { splitVisualRuns, toVisualOrder } from '../pdf';

const reverse = (s: string) => s.split('').reverse().join('');

/** מדמה את fontkit: מקטע שמתחיל (אחרי ניטרלים) באות עברית מתהפך כולו. */
function fontkitLike(text: string): string {
  const firstStrong = text.match(/[֐-׿A-Za-z]/)?.[0];
  return firstStrong && /[֐-׿]/.test(firstStrong) ? reverse(text) : text;
}

describe('toVisualOrder', () => {
  it('עברית טהורה — הפוכה לציור משמאל לימין', () => {
    expect(toVisualOrder('טופס הסכמה חתום')).toBe(reverse('טופס הסכמה חתום'));
  });

  it('ספרות נשמרות בסדרן ומוצבות משמאל לעברית', () => {
    expect(toVisualOrder('טלפון: 0528245963')).toBe('0528245963 :ןופלט');
  });

  it('LRM מוסר מהפלט ושומר תאריך+שעה כיחידה אחת בסדר הנכון', () => {
    const visual = toVisualOrder('נחתם בתאריך: ‎13/11/2026 23:11‎');
    expect(visual).not.toMatch(/‎/);
    expect(visual).toBe('13/11/2026 23:11 :ךיראתב םתחנ');
  });

  it('ללא LRM — השעה הייתה מופיעה לפני התאריך (הסבר לצורך ב-LRM)', () => {
    expect(toVisualOrder('נחתם בתאריך: 13/11/2026 23:11')).toBe('23:11 13/11/2026 :ךיראתב םתחנ');
  });

  it('מחרוזת ריקה', () => {
    expect(toVisualOrder('')).toBe('');
  });
});

describe('splitVisualRuns', () => {
  it('מקטע עברי מוחזר בסדר לוגי, כך שההיפוך של fontkit מחזיר את הסדר החזותי', () => {
    const visual = toVisualOrder('טופס הסכמה חתום');
    const runs = splitVisualRuns(visual);
    expect(runs).toHaveLength(1);
    expect(runs[0].rtl).toBe(true);
    expect(runs[0].text).toBe('טופס הסכמה חתום');
    expect(runs.map((r) => fontkitLike(r.text)).join('')).toBe(visual);
  });

  it('שורה מעורבת — ספרות/לטינית נשארות כפי שהן, העברית לוגית; השרשור שווה לחזותי', () => {
    for (const logical of [
      'נחתם בתאריך: ‎13/11/2026 23:11‎',
      'כתובת IP: 147.236.163.128',
      'טלפון: 0528245963',
      'חתימת אימות (Hash): 5b15bee6fce1f0f9...',
      'שם הלקוח/ה: שרה לוי',
      'הערות: Hydrafacial ואז 2 טיפולים',
    ]) {
      const visual = toVisualOrder(logical);
      const runs = splitVisualRuns(visual);
      expect(runs.map((r) => fontkitLike(r.text)).join('')).toBe(visual);
      for (const run of runs) {
        if (run.rtl) expect(run.text).toMatch(/[֐-׿]/);
        else expect(run.text).not.toMatch(/[֐-׿]/);
      }
    }
  });

  it('תווים ניטרליים בתחילת מקטע עברי נשמרים במקומם', () => {
    const visual = toVisualOrder('שלום:');
    expect(visual).toBe(':םולש');
    const runs = splitVisualRuns(visual);
    expect(runs).toHaveLength(1);
    expect(fontkitLike(runs[0].text)).toBe(':םולש');
  });

  it('מחרוזת ריקה — ללא מקטעים', () => {
    expect(splitVisualRuns('')).toEqual([]);
  });
});
