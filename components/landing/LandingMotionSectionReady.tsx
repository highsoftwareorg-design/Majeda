"use client";

import { useEffect, type ReactNode } from "react";
import {
  markLandingSectionReady,
  type StreamedLandingSection,
} from "@/lib/motion/landing-motion";

/**
 * משימה 2.16 — עטיפת Client דקה (ללא DOM משלה) לסקשנים שמגיעים ב-Suspense
 * (TreatmentsSection, ContactFormSectionContainer — שניהם נשארים Server Components
 * ומועברים כ-children). ה-effect רץ רק אחרי שה-boundary סיים hydration, ואז מסמן
 * לרכיב התזמור שמותר להחיל עליו סגנונות GSAP בלי לגרום לאי-התאמת hydration.
 */
export function LandingMotionSectionReady({
  section,
  children,
}: {
  section: StreamedLandingSection;
  children: ReactNode;
}) {
  useEffect(() => {
    markLandingSectionReady(section);
  }, [section]);

  return <>{children}</>;
}

export default LandingMotionSectionReady;
