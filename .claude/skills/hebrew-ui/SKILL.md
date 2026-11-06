---
name: hebrew-ui
description: Use this skill whenever building or reviewing any user-facing UI (web pages, components, forms, dashboards, emails) for this project, to make sure the interface text is in Hebrew, the layout is RTL-correct, and the design is mobile-responsive. Trigger on requests like "build a page/form/component/dashboard", "add a UI", "review the UI", or whenever HTML/CSS/JSX/TSX markup with user-facing text is written or edited.
---

# Hebrew UI — RTL & Mobile Checklist

מטרת ה-skill הזו: לוודא שכל ממשק משתמש בפרויקט הוא **בעברית**, **RTL תקין**, ו**מותאם לנייד**. יש להפעיל אותה לפני סיום כתיבת כל קומפוננטת UI, עמוד, טופס או דשבורד חדש, וכן בעת סקירה/תיקון של ממשק קיים.

## 1. שפה — עברית
- כל טקסט גלוי למשתמש (כותרות, labels, placeholders, הודעות שגיאה/הצלחה, tooltips, alt text, aria-label, כפתורים, ניווט, meta title/description) חייב להיות בעברית תקנית וברורה.
- אין להשאיר טקסטים לועזיים "זמניים" (lorem ipsum, TODO, placeholder באנגלית) בקוד שמוצג למשתמש.
- פורמטים (תאריכים, מספרים, מטבע) מוצגים בפורמט הנהוג בעברית/ישראל (לדוגמה: `DD/MM/YYYY`, `₪`).
- אם יש תוכן רב-לשוני (i18n), עברית היא שפת ברירת המחדל (`default locale`), ומפתחות התרגום לא מוצגים גולמיים במקרה של מפתח חסר.

## 2. כיוון — RTL
- קבע `dir="rtl"` ו-`lang="he"` ברמת המסמך (`<html dir="rtl" lang="he">`), לא רק על קונטיינר פנימי, אלא אם קיימת סיבה מפורשת לעשות זאת ברמת קומפוננטה בלבד.
- השתמש בתכונות CSS לוגיות ולא פיזיות, כדי שהפריסה תתהפך נכון אוטומטית:
  - `margin-inline-start/end` במקום `margin-left/right`
  - `padding-inline-start/end` במקום `padding-left/right`
  - `inset-inline-start/end` במקום `left/right`
  - `text-align: start/end` במקום `text-align: left/right`
  - `border-inline-start/end` במקום `border-left/right`
- אם המסגרת/הספרייה לא תומכת ב-logical properties (למשל Tailwind ישן), השתמש במחלקות RTL-aware (`ms-`/`me-` ב-Tailwind החדש, או variant `rtl:`) במקום `ml-`/`mr-` קשיחים.
- אייקונים כיווניים (חצים, "הבא/הקודם", חץ חזרה) חייבים להתהפך בהתאם לכיוון — לבדוק שחץ "הבא" מצביע שמאלה ב-RTL, לא ימינה.
- רכיבים כמו תפריטי צד (sidebar), ניווט עליון, breadcrumbs, פאנלים נפתחים (dropdown/drawer) — לבדוק שהם נפתחים/ממוקמים בצד הנכון ב-RTL.
- טקסט מעורב (עברית + מספרים/אנגלית, כמו שם משתמש או אימייל) — לוודא שאין "קפיצות" כיוון מוזרות (bidi issues); לעטוף טקסט לטיני בתוך טקסט עברי ב-`<bdi>` או `unicode-bidi: isolate` כשרלוונטי.
- גרפים, טבלאות וקלנדרים — לבדוק שהציר/סדר העמודות הגיוני ב-RTL (למשל טבלה שעמודת הפעולות בצד שמאל בעברית, לא ימין).

## 3. התאמה לנייד (Responsive)
- עיצוב ב-mobile-first: ודא שהעמוד/קומפוננטה קריאים ושמישים ברוחב מסך טלפון (320–430px) לפני בדיקת מסכים גדולים.
- ללא גלילה אופקית בלתי רצויה (`overflow-x`) במובייל.
- שימוש ביחידות גמישות (`%`, `rem`, `vw`, `clamp()`, `grid`/`flex` עם `wrap`) במקום רוחב/פריסה קשיחה בפיקסלים.
- אזורי לחיצה (כפתורים, קישורים, שדות טופס) בגודל נגיש למגע — לפחות כ-44x44px.
- טפסים: שדות בעמודה אחת במובייל, מקלדת מתאימה לסוג השדה (`type="tel"`, `type="email"` וכו').
- תמונות/מדיה responsive (`max-width: 100%`, `srcset` בעת הצורך).
- בדוק גם Safe Area לנייד (notch) בעת הצורך: `env(safe-area-inset-*)`.
- בדוק breakpoints סבירים (למשל `sm`/`md`/`lg`) ושה-layout עובר בצורה הגיונית בין נייד/טאבלט/דסקטופ.

## תהליך עבודה מומלץ
1. בכתיבת כל עמוד/קומפוננטה חדשה — התחל עם `dir="rtl" lang="he"` ברמת השורש, וכתוב את כל הטקסטים ישירות בעברית.
2. בנה את ה-CSS/עיצוב עם logical properties ו-mobile-first מההתחלה, לא כ"תיקון" בסוף.
3. לפני סיום משימה, עבור על הצ'ק-ליסט הבא:

```
☐ כל הטקסט הגלוי בעברית (אין אנגלית/placeholder זמני)
☐ <html dir="rtl" lang="he"> (או מקביל) מוגדר
☐ אין שימוש ב-left/right פיזי שצריך היה להיות logical/RTL-aware
☐ אייקונים כיווניים מותאמים לכיוון RTL
☐ תפריטים/dropdowns/drawers נפתחים בצד הנכון
☐ אין גלילה אופקית לא רצויה במובייל (320px ומעלה)
☐ אזורי לחיצה מספיק גדולים למגע
☐ הטפסים נוחים למילוי במובייל (מקלדת מתאימה, עמודה אחת)
☐ תאריכים/מספרים/מטבע בפורמט ישראלי
```

4. אם נמצאה בעיה — תקן אותה מיד בקוד (אל תדווח "יש בעיה" בלי לתקן, אלא אם התיקון דורש החלטת עיצוב מהמשתמש).
5. בסיום, תן סיכום קצר בעברית של מה נבדק ותוקן.

## מה אסור
- להשאיר ממשק עם טקסט באנגלית בפרודקשן בלי שהמשתמש ביקש זאת במפורש.
- להשתמש ב-`dir="ltr"` או בברירת מחדל LTR לממשקים בעברית.
- לבנות עיצוב שעובד רק בדסקטופ ולהתעלם ממובייל.
