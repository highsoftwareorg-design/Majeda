import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import fs from "node:fs";
import path from "node:path";
import { compile } from "@tailwindcss/node";

/**
 * משימה 2.21 — קצב רצועות בהיר/כהה, תמונות בסקשנים ואילוץ היושרה.
 * getTreatments מדומה (נתוני בדיקה מומצאים בלבד) — אותו דפוס כמו Accessibility.test.tsx.
 */
const getTreatmentsMock = vi.hoisted(() => vi.fn());
const FAKE_TREATMENTS = vi.hoisted(() =>
  ["א", "ב", "ג"].map((suffix, i) => ({
    id: `t${i + 1}`,
    name: `טיפול בדיקה ${suffix}`,
    description: i === 1 ? null : `תיאור ${suffix}`,
    price: 250 + i * 50,
    durationMinutes: 45 + i * 15,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })),
);
vi.mock("@/lib/db/treatments", () => ({
  getTreatments: () => getTreatmentsMock(),
}));

import { Hero } from "@/components/landing/Hero";
import { TreatmentsSection } from "@/components/landing/TreatmentsSection";
import { BeforeAfterSection, BEFORE_AFTER_COMING_SOON } from "@/components/landing/BeforeAfterSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { SectionDivider } from "@/components/landing/SectionDivider";
import { AboutSection } from "@/components/landing/AboutSection";
import { ContactFormSectionContainer } from "@/components/landing/ContactFormSectionContainer";
import { ContactInfoSection } from "@/components/landing/ContactInfoSection";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppFloatingButton } from "@/components/landing/WhatsAppFloatingButton";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { SECTION_IMAGES } from "@/lib/landing/section-images";
import { STOCK_IMAGES } from "@/lib/landing/stock-images";

const ROOT = path.resolve(__dirname, "../../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** הסדר בפועל ב-app/page.tsx — הבדיקה משווה אליו כדי שהקומפוזיציה כאן לא "תסטה" מהדף. */
const PAGE_ORDER = [
  "Hero",
  "TreatmentsSection",
  "BeforeAfterSection",
  "TestimonialsSection",
  "SectionDivider",
  "AboutSection",
  "ContactFormSectionContainer",
  "ContactInfoSection",
  "Footer",
];

async function renderLandingPage() {
  getTreatmentsMock.mockResolvedValue(FAKE_TREATMENTS);
  const treatments = await TreatmentsSection();
  const contactForm = await ContactFormSectionContainer();
  return render(
    <main dir="rtl" lang="he" className="flex min-h-screen w-full flex-col bg-ink text-champagne">
      <LandingMotion />
      <Hero />
      {treatments}
      <BeforeAfterSection />
      <TestimonialsSection />
      <SectionDivider />
      <AboutSection />
      {contactForm}
      <ContactInfoSection />
      <Footer />
      <WhatsAppFloatingButton />
    </main>,
  );
}

/** טון → מחלקת הרקע שחייבת להופיע על הרצועה (כדי שה-data-band-tone לא "ישקר"). */
const TONE_CLASS: Record<string, RegExp> = {
  ink: /(^|\s)bg-ink(-glow|-glow-close)?(\s|$)/,
  "ink-raised": /(^|\s)bg-ink-raised(\s|$)/,
  champagne: /(^|\s)bg-champagne(-wash)?(\s|$)/,
  sand: /(^|\s)bg-sand(\s|$)/,
  porcelain: /(^|\s)bg-porcelain(\s|$)/,
  blush: /(^|\s)bg-blush(\s|$)/,
  image: /(^|\s)bg-/,
};

describe("2.21 — light/dark band rhythm", () => {
  it("the test composition matches the component order in app/page.tsx", () => {
    const src = read("app/page.tsx");
    const body = src.slice(src.indexOf("export default function Home"));
    const order = [...body.matchAll(/<([A-Z][A-Za-z]+)\s*\/>/g)]
      .map((m) => m[1])
      .filter((name) => PAGE_ORDER.includes(name));
    expect(order).toEqual(PAGE_ORDER);
  });

  it("has ≥3 light bands, alternates with dark bands, and no two adjacent bands share a shade", async () => {
    const { container } = await renderLandingPage();
    const bands = Array.from(container.querySelectorAll("main > [data-band]"));
    const tones = bands.map((b) => b.getAttribute("data-band-tone"));
    expect(tones).toEqual([
      "ink", // Hero
      "champagne", // טיפולים
      "ink-raised", // לפני/אחרי
      "sand", // המלצות
      "image", // מפריד
      "porcelain", // אודות
      "ink", // טופס
      "ink-raised", // פרטי קשר
      "ink", // Footer
    ]);

    const kinds = bands.map((b) => b.getAttribute("data-band"));
    expect(kinds.filter((k) => k === "light").length).toBeGreaterThanOrEqual(3);
    expect(kinds.filter((k) => k === "image").length).toBeLessThanOrEqual(2);

    for (let i = 1; i < tones.length; i++) {
      expect(tones[i], `bands ${i - 1}/${i}`).not.toBe(tones[i - 1]);
    }
    // הבהיר הראשון מגיע מיד אחרי ה-Hero; עד "פרק הסגירה" הכהה (טופס → פרטי קשר → Footer)
    // אין שתי רצועות כהות ברצף.
    expect(kinds[1]).toBe("light");
    const closing = kinds.length - 3;
    for (let i = 1; i < closing; i++) {
      expect(kinds[i - 1] === "dark" && kinds[i] === "dark", `bands ${i - 1}/${i}`).toBe(false);
    }

    bands.forEach((band, i) => {
      expect(band.getAttribute("class") ?? "", `band ${i} (${tones[i]})`).toMatch(TONE_CLASS[tones[i]!]);
    });
  });

  it("light bands use only the 2.11-verified light-surface text tokens (never gold-dark on blush, no dark-surface text)", async () => {
    const { container } = await renderLandingPage();
    for (const band of container.querySelectorAll('main > [data-band="light"]')) {
      const html = band.innerHTML;
      expect(html).not.toMatch(/text-(gold-pale|champagne-muted|champagne|gold|gold-light)(?=[\s"])/);
      if (/bg-blush/.test(band.className)) expect(html).not.toMatch(/text-gold-dark/);
    }
  });
});

describe("2.21 — integrity: no stock imagery in before/after or the team", () => {
  const STOCK = /images\/stock|%2Fimages%2Fstock/i;

  it("BeforeAfterSection renders no <img> and no stock path, and its source never imports images", () => {
    const { container } = render(<BeforeAfterSection />);
    expect(container.querySelectorAll("img, picture, source, image")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(STOCK);
    for (const el of container.querySelectorAll<HTMLElement>("*")) {
      expect(el.style.backgroundImage).toBe("");
    }
    // קוד המקור (ללא הערות) אינו מייבא תמונות ואינו מכיל נתיב סטוק או תגית תמונה.
    const code = read("components/landing/BeforeAfterSection.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/next\/image|stock-images|section-images|images\/stock|<img\b|<Image\b/);
  });

  it("the team part of AboutSection renders no <img> and no stock path", () => {
    const { container } = render(<AboutSection />);
    const team = container.querySelector("[data-about-team]")!;
    expect(team).not.toBeNull();
    expect(team.querySelectorAll("img, picture, source, image")).toHaveLength(0);
    expect(team.innerHTML).not.toMatch(STOCK);
    // תמונת האווירה של האודות קיימת — אך מחוץ לרשימת הצוות ולא בתוך פריט צוות.
    const aboutImage = container.querySelector('[data-landing-image="about"]')!;
    expect(aboutImage).not.toBeNull();
    expect(team.contains(aboutImage)).toBe(false);
    expect(aboutImage.closest("[data-about-member]")).toBeNull();
    // הדיוקנאות נשארו placeholders דקורטיביים.
    for (const p of team.querySelectorAll("[data-about-portrait]")) {
      expect(p).toHaveAttribute("aria-hidden", "true");
      expect(p.children).toHaveLength(0);
    }
  });

  it("shows the visible 'coming soon' caption", () => {
    render(<BeforeAfterSection />);
    expect(BEFORE_AFTER_COMING_SOON).toBe("בקרוב — תוצאות אמיתיות מהמרפאה");
    const caption = screen.getByText("בקרוב — תוצאות אמיתיות מהמרפאה");
    expect(caption).toBeVisible();
    expect(caption.closest("[aria-hidden]")).toBeNull();
    expect(caption).toHaveAttribute("data-before-after-caption");
  });

  it("before/after placeholders are labelled in Hebrew and carry no hover zoom (frame-zoom is for images only)", () => {
    const { container } = render(<BeforeAfterSection />);
    const frames = container.querySelectorAll("[data-before-after-frame]");
    expect(frames).toHaveLength(6);
    frames.forEach((f) => {
      expect(f.className).not.toMatch(/frame-zoom/);
      expect(f.getAttribute("aria-label")).not.toMatch(/[A-Za-z]/);
    });
  });
});

describe("2.21 — section images", () => {
  it("treatments still render from the mocked getTreatments, alongside one section-level atmosphere image", async () => {
    getTreatmentsMock.mockReset();
    getTreatmentsMock.mockResolvedValue(FAKE_TREATMENTS);
    const ui = await TreatmentsSection();
    const { container } = render(<>{ui}</>);
    expect(getTreatmentsMock).toHaveBeenCalledTimes(1);
    const list = container.querySelector("[data-treatments-list]") as HTMLElement;
    expect(within(list).getAllByRole("listitem")).toHaveLength(FAKE_TREATMENTS.length);
    for (const t of FAKE_TREATMENTS) {
      expect(screen.getByRole("heading", { level: 3, name: t.name })).toBeInTheDocument();
    }
    // תמונה אחת לסקשן — לא תמונה לכל טיפול.
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(list.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByRole("img", { name: SECTION_IMAGES.treatments.alt })).toBeInTheDocument();
  });

  it("every section image comes from the 2.19 data source, is wrapped in an overflow-hidden [data-landing-image] with a fixed aspect, lazy and sized; only the Hero has priority", async () => {
    const { container } = await renderLandingPage();
    const wrappers = Array.from(container.querySelectorAll<HTMLElement>("[data-landing-image]"));
    expect(wrappers.map((w) => w.dataset.landingImage)).toEqual(["hero", "treatments", "divider", "about"]);

    const sources = new Set<string>(Object.values(STOCK_IMAGES).map((i) => i.src));
    for (const w of wrappers) {
      expect(w.className).toMatch(/(^|\s)overflow-hidden(\s|$)/);
      const imgs = w.querySelectorAll("img");
      expect(imgs).toHaveLength(1);
      const img = imgs[0];
      expect(img.className).toMatch(/(^|\s)object-cover(\s|$)/);
      expect(img.getAttribute("sizes")).toBeTruthy();
      const url = new URL(img.getAttribute("src")!, "http://localhost").searchParams.get("url");
      expect(sources.has(url ?? img.getAttribute("src")!)).toBe(true);

      if (w.dataset.landingImage === "hero") {
        expect(img).toHaveAttribute("fetchpriority", "high");
        continue;
      }
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).not.toHaveAttribute("fetchpriority");
      // יחס קבוע (aspect-*) על המכל → מקום שמור מראש, ללא CLS.
      expect(w.className).toMatch(/(^|\s)aspect-/);
    }

    expect(container.querySelector('[data-landing-image="treatments"] img')).toHaveAttribute(
      "alt",
      SECTION_IMAGES.treatments.alt,
    );
    expect(container.querySelector('[data-landing-image="about"] img')).toHaveAttribute("alt", SECTION_IMAGES.about.alt);
    // המפריד דקורטיבי: alt ריק ומוסתר מטכנולוגיה מסייעת.
    expect(container.querySelector('[data-landing-image="divider"] img')).toHaveAttribute("alt", "");
    expect(container.querySelector("[data-landing-divider]")).toHaveAttribute("aria-hidden", "true");
  });

  it("frame-zoom appears only on wrappers that contain a real image", async () => {
    const { container } = await renderLandingPage();
    const zooms = container.querySelectorAll(".frame-zoom");
    expect(zooms.length).toBeGreaterThan(0);
    zooms.forEach((z) => expect(z.querySelector("img")).not.toBeNull());
  });

  it("the full page (with the new bands and images) has no axe violations", async () => {
    const { container } = await renderLandingPage();
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * תיקון ממצא ה-tester של 2.20: טבעת הפוקוס של ה-CTA ב-Hero הייתה gold-light/60 — 2.79:1 מול ה-scrim
 * במקרה הגרוע (rgb(89,89,89)). עכשיו: offset אטום ב-ink (2px) + טבעת gold-light אטומה (3px).
 */
describe("2.21 — Hero CTA focus ring reaches ≥3:1 against the worst-case scrim", () => {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const ratio = (a: number[], b: number[]) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it("uses an opaque gold-light ring over an opaque ink offset (no translucent ring)", async () => {
    render(<Hero />);
    const cta = screen.getByRole("link", { name: "לקביעת תור" });
    const classes = (cta.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
    expect(classes).toEqual(
      expect.arrayContaining([
        "focus-visible:ring-3",
        "focus-visible:ring-gold-light",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-ink",
      ]),
    );
    expect(classes.filter((c) => /^focus-visible:ring-[a-z-]+\/\d+$/.test(c))).toEqual([]);

    const compiler = await compile('@import "tailwindcss";\n@import "./styles/tokens.css";', {
      base: ROOT,
      onDependency: () => {},
    });
    const css = compiler.build(classes);
    const utilities = css.slice(css.indexOf("@layer utilities"));
    expect(utilities).toMatch(/\.focus-visible\\:ring-gold-light:focus-visible\s*{[^}]*--tw-ring-color:\s*var\(--color-gold-light\)/);
    expect(utilities).toMatch(/\.focus-visible\\:ring-offset-ink:focus-visible\s*{[^}]*--tw-ring-offset-color:\s*var\(--color-ink\)/);
    expect(utilities).toMatch(/\.focus-visible\\:ring-offset-2:focus-visible\s*{[^}]*--tw-ring-offset-width:\s*2px/);

    const token = (name: string) => {
      const m = css.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`));
      expect(m, `token ${name}`).not.toBeNull();
      return hexRgb(m![1]);
    };
    const worstScrim = [89, 89, 89]; // ink 68% על לבן (2.20)
    expect(ratio(token("--color-gold-light"), worstScrim)).toBeGreaterThanOrEqual(3); // 4.79
    expect(ratio(token("--color-gold-light"), token("--color-ink"))).toBeGreaterThanOrEqual(3); // 13.45
    expect(ratio(token("--color-ink"), token("--color-gold"))).toBeGreaterThanOrEqual(3); // 9.00
  });
});
