import type { Metadata } from "next";
import { Geist_Mono, Frank_Ruhl_Libre, Assistant } from "next/font/google";
import "./globals.css";
import { AccessibilityWidget } from "@/components/accessibility/AccessibilityWidget";
import { buildA11yInlineScript } from "@/lib/a11y/preferences";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Frank Ruhl Libre — גופן הכותרות (עברית), לפי נספח א.7
const frankRuhlLibre = Frank_Ruhl_Libre({
  variable: "--font-heading",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
});

// Assistant — גופן הטקסט הרץ, הממשק והמספרים הטבלאיים (עברית), לפי נספח א.7
const assistant = Assistant({
  variable: "--font-body",
  subsets: ["hebrew", "latin"],
});

// כתובת האתר בפרודקשן טרם נקבעה סופית — ברירת מחדל זמנית (placeholder) עד שתסופק
// כתובת דומיין רשמית; ניתן לדרוס דרך משתנה הסביבה NEXT_PUBLIC_SITE_URL.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.majida-beaute.co.il";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MAJIDA Beauté Center | יופי נצחי, בנגיעה אישית",
    template: "%s | MAJIDA Beauté Center",
  },
  description:
    "MAJIDA Beauté Center — מרפאת יופי וטיפולים אסתטיים. יופי נצחי, בנגיעה אישית. קביעת תור, טיפולי פנים וגוף מתקדמים וליווי אישי מקצועי.",
};

// משימה 2.18 — מחיל את העדפות הנגישות השמורות (data-* על <html>) לפני הציור הראשון ולפני
// ה-hydration: ללא הבהוב, ו-LandingMotion לא יוצר אנימציה כלל כשהעצירה שמורה. סקריפט פנימי
// קצר וסטטי בלבד (ללא צד שלישי, ללא מידע אישי).
const A11Y_INLINE_SCRIPT = buildA11yInlineScript();

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${frankRuhlLibre.variable} ${assistant.variable} ${geistMono.variable} h-full antialiased`}
      // הסקריפט ה-inline מוסיף data-a11y-*/data-reduce-motion ל-<html> לפני ה-hydration —
      // אי-התאמה צפויה ומכוונת באלמנט הזה בלבד.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_INLINE_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <AccessibilityWidget />
      </body>
    </html>
  );
}
