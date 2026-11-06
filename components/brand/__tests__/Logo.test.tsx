import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "@/components/brand/Logo";

/**
 * משימה 2.12 — Logo: prop חדש `fluid` ו-data-slot/data-variant.
 * מוודא שברירת המחדל (בשימוש Footer/login/test-logo) לא השתנתה.
 */
function getImg() {
  return screen.getByRole("img", { name: "MAJIDA Beauté Center" }) as HTMLImageElement;
}

describe("Logo", () => {
  it("default (non-fluid) keeps a fixed pixel width and no w-full on the wrapper", () => {
    const { container } = render(<Logo variant="full" size={200} />);
    const img = getImg();
    expect(img.getAttribute("width")).toBe("200");
    expect(img.getAttribute("height")).toBe("200");
    expect(img.style.width).toBe("200px");
    expect(img.style.height).toBe("auto");
    expect(img.getAttribute("sizes")).toBeNull();
    const wrapper = container.querySelector('[data-slot="logo"]')!;
    expect(wrapper.className).not.toMatch(/(^|\s)w-full(\s|$)/);
  });

  it("exposes data-slot and data-variant", () => {
    const { container, rerender } = render(<Logo />);
    let wrapper = container.querySelector('[data-slot="logo"]');
    expect(wrapper).toHaveAttribute("data-variant", "full");
    rerender(<Logo variant="transparent" />);
    wrapper = container.querySelector('[data-slot="logo"]');
    expect(wrapper).toHaveAttribute("data-variant", "transparent");
    expect(getImg().getAttribute("src")).toContain("majida_logo_transparent.svg");
  });

  it("fluid fills its container with a min of 120px and max of size", () => {
    const { container } = render(<Logo variant="full" size={260} fluid />);
    const img = getImg();
    expect(img.getAttribute("width")).toBe("260");
    expect(img.style.inlineSize).toBe("100%");
    expect(img.style.maxInlineSize).toBe("260px");
    expect(img.style.minInlineSize).toBe("120px");
    expect(img.style.height).toBe("auto");
    // SVG src => next/image renders unoptimized and drops `sizes`, so no assertion on it
    const wrapper = container.querySelector('[data-slot="logo"]')!;
    expect(wrapper.className).toMatch(/(^|\s)w-full(\s|$)/);
  });

  it("enforces the 120px minimum for the full logo (brand rule A.8)", () => {
    render(<Logo variant="full" size={50} />);
    const img = getImg();
    expect(img.getAttribute("width")).toBe("120");
    expect(img.style.width).toBe("120px");
  });

  it("enforces the 120px minimum also in fluid mode", () => {
    render(<Logo variant="full" size={50} fluid />);
    const img = getImg();
    expect(img.getAttribute("width")).toBe("120");
    expect(img.style.minInlineSize).toBe("120px");
    expect(img.style.maxInlineSize).toBe("120px");
  });

  it("allows 32px minimum when asIcon", () => {
    render(<Logo variant="transparent" asIcon />);
    expect(getImg().getAttribute("width")).toBe("32");
  });

  it("keeps priority (not lazy-loaded) for non-icon usage, fluid or not", () => {
    const { unmount } = render(<Logo variant="full" />);
    expect(getImg().getAttribute("loading")).not.toBe("lazy");
    unmount();
    render(<Logo variant="full" fluid />);
    expect(getImg().getAttribute("loading")).not.toBe("lazy");
  });

  it("does not use priority for icon usage (lazy-loaded)", () => {
    render(<Logo variant="transparent" asIcon />);
    expect(getImg().getAttribute("loading")).toBe("lazy");
  });

  it("merges a custom className onto the wrapper", () => {
    const { container } = render(<Logo className="custom-x" />);
    expect(container.querySelector('[data-slot="logo"]')).toHaveClass("custom-x");
  });
});
