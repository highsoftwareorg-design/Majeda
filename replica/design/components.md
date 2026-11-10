# Honey-beauty.md — Component Specs
_Source: live homepage HTML and base stylesheet, re-checked 2026-11-10. MAJIDA column = equivalent / mapping. Honey colours are reference only; MAJIDA keeps its own palette._

---

## SectionEyebrow
```
pattern   <p class="font-body text-xs font-semibold uppercase tracking-widest">01 / SECTION NAME</p>
size      text-xs (12px) — honey's own .eyebrow is 9–11px, weight 600, wide tracking
tracking  tracking-widest (0.1em) — kept as the floor
color     gold-deep on champagne/sand, gold on ink (contrast rules in tokens.css)
majida    done on all landing sections (Hero 00, Treatments 01, About 02, Testimonials 04, Contact 05)
```

## DisplayHeading
```
pattern   <h2>Some words <em>last-word</em></h2>
font      serif display (Frank Ruhl Libre — same job as honey's Cormorant Garamond)
weight    400 (not bold)
italic    last 1–2 words in <em>  — confirmed on honey site (27 uses)
rule      rule-gilded (1px gold gradient, 4rem) directly below heading
majida    done ✓
```

## ServiceIndexCard
```
pattern   01
          Treatment Name
          Short tagline
          Duration · Price
structure li with aria-hidden index span at top-start
index     font-size: var(--type-index) = clamp(2rem, 3vw, 3.5rem) → text-index
          font-weight: 300 → font-light
          color: gold-deep on light bands
divider   1px hairline between items (no card box, no shadow, no radius)
hover     gilded underline animation (hover-gilded-line) — no text color change
majida    done ✓ (TreatmentsSection: text-index font-light)
observed  honey's own numerals are small (~10px, muted). The large index is a MAJIDA
          layout choice, documented here so it is not mistaken for a copy of their site.
```

## CtaArrowLink
```
pattern   Label ↗︎  (outbound / primary action)   ← U+FE0E keeps the glyph in text form
          Label ↓   (anchor scroll)
arrow     aria-hidden="true" span after label text
style     plain — no border, no fill, text color = accent or text
observed  honey uses ↗︎ on 48 outbound links and ↓ on 3 anchor links
majida    Hero ↓ ✓. Social links on Contact are icon-only (no arrow, aria-label).
```

## TextLinkHairline (new observation, not yet used on landing)
```
pattern   <a class="text-link">Label ↓</a>
style     font-size ~11px (honey) → text-caption (14px) in MAJIDA
          border-bottom: 1px hairline (hairline-light), padding-bottom: 8px
state     hover: underline colour → gold-deep
majida    not yet used. Candidate for a secondary CTA under treatments or about.
```

## ServicePills
```
pattern   <div aria-label="תחומי טיפול">פנים <span aria-hidden>·</span> גוף <span aria-hidden>·</span> שיער <span aria-hidden>·</span> ציפורניים</div>
style     font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: champagne
spacing   gap-3 between items; separator · aria-hidden
majida    done ✓ (Hero)
```

## TestimonialCard
```
glyph     <span aria-hidden>“</span> (U+201C), font-size: text-display, color: gold-pale
          (honey: .quote-mark, aria-hidden, same position at card top-start)
quote     <blockquote> body text; closing ” appended in text only
author    bold, charcoal on sand
source    caption, taupe
layout    no box-shadow, border-s hairline on the start side
majida    done ✓
```

## FooterSeparator
```
pattern   Link1 <span aria-hidden>✳</span> Link2 <span aria-hidden>✳</span> Link3
glyph     ✳ (U+2733), color: gold, font-size smaller than link text
observed  honey uses ✳ as <i> separators in service detail lists too
majida    done ✓ (Footer.tsx)
```

## NavLink
```
style     plain uppercase tracked text; no underline default; underline on hover/focus
arrow     none on nav (arrows only on action CTAs)
active    thin accent underline (2px, text-gold)
```

## Button (primary CTA)
```
variants  primary (gold fill, ink text), ghost (border only)
sizes     sm 36px · md 44px · lg 52px (MAJIDA Hero uses h-12)
states    hover: lightened fill; focus-visible: 3px ring offset; disabled: opacity-40
radius    0px (honey observed) — MAJIDA uses 8px; either is acceptable
majida    existing Button component ✓ — no change needed
```

---

## Gaps / Tokens (status 2026-11-10)

| gap | status |
|-----|--------|
| eyebrow tracking too narrow (0.02em) | done: tracking-widest on all landing eyebrows |
| index number size (01/02 on cards) | done: `--type-index` / `--text-index` in styles/tokens.css, used in TreatmentsSection |
| index number weight (300) | done: `font-light` on index span |
| card radius: honey 0px, MAJIDA 8px | out of scope for this sync; left as-is |
| shadow: honey none, MAJIDA shadow-glow on Hero | out of scope for this sync; left as-is |
| text-link hairline underline | not applied; no landing link fits yet (candidate for a later task) |
| outbound ↗︎ arrow on text links | not applied; Contact social links are icon-only |
