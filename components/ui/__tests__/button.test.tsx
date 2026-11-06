import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * משימה 2.15 — וריאנט `brand` וגודל `xl` נוספו ל-buttonVariants.
 * מוודא: (1) הווריאנט מרנדר צבע טקסט ink (לא נמחק ע"י cn/tailwind-merge
 * בגלל קונפליקט text-* — הערת 2.12); (2) הווריאנטים הקיימים לא השתנו.
 */
const classesOf = (el: HTMLElement) => el.className.split(/\s+/);

describe("Button — brand variant (task 2.15)", () => {
  it("brand keeps text-ink and the custom font-size, drops base text-sm", () => {
    render(
      <Button variant="brand" size="xl">
        שליחה
      </Button>
    );
    const cls = classesOf(screen.getByRole("button", { name: "שליחה" }));
    expect(cls).toContain("text-ink");
    expect(cls).toContain("bg-gold");
    expect(cls).toContain("text-(length:--type-body)");
    expect(cls).not.toContain("text-sm");
    expect(cls).toContain("hover:bg-gold-light");
  });

  it("brand focus styles override the shadcn default ring/border", () => {
    render(<Button variant="brand">x</Button>);
    const cls = classesOf(screen.getByRole("button"));
    expect(cls).toContain("focus-visible:border-gold-light");
    expect(cls).toContain("focus-visible:ring-gold-light/60");
    expect(cls).not.toContain("focus-visible:border-ring");
    expect(cls).not.toContain("focus-visible:ring-ring/50");
    expect(cls).toContain("focus-visible:ring-3");
  });

  it("brand + layout className from ContactFormSection does not drop text-ink", () => {
    render(
      <Button
        variant="brand"
        size="xl"
        className="w-full sm:col-span-2 sm:w-auto sm:min-w-52 sm:justify-self-start"
      >
        x
      </Button>
    );
    const cls = classesOf(screen.getByRole("button"));
    expect(cls).toContain("text-ink");
    expect(cls).toContain("text-(length:--type-body)");
  });

  it("xl size is 48px tall (h-12) and overrides default h-8", () => {
    render(<Button variant="brand" size="xl">x</Button>);
    const cls = classesOf(screen.getByRole("button"));
    expect(cls).toContain("h-12");
    expect(cls).not.toContain("h-8");
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "brand");
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "xl");
  });

});

describe("Button — existing variants unchanged", () => {
  it("default variant/size", () => {
    render(<Button>כפתור לדוגמה</Button>);
    const el = screen.getByRole("button");
    const cls = classesOf(el);
    expect(cls).toEqual(
      expect.arrayContaining([
        "bg-primary",
        "text-primary-foreground",
        "hover:bg-primary/80",
        "h-8",
        "text-sm",
        "focus-visible:border-ring",
        "focus-visible:ring-ring/50",
      ])
    );
    expect(el).toHaveAttribute("data-variant", "default");
    expect(el).toHaveAttribute("data-size", "default");
  });

  it("outline variant (used in /clients and /test-shadcn)", () => {
    render(<Button variant="outline">x</Button>);
    expect(classesOf(screen.getByRole("button"))).toEqual(
      expect.arrayContaining(["border-border", "bg-background", "hover:bg-muted", "h-8"])
    );
  });

  it("Hero-style className overrides on default variant still apply (bg-gold, text-ink, h-12)", () => {
    render(
      <Button className="mt-2 h-12 min-w-44 bg-gold px-8 text-ink shadow-glow hover:bg-gold-light focus-visible:ring-gold-light/60">
        <span className="text-body font-semibold">לקביעת תור</span>
      </Button>
    );
    const cls = classesOf(screen.getByRole("button"));
    expect(cls).toEqual(expect.arrayContaining(["bg-gold", "text-ink", "h-12", "px-8"]));
    expect(cls).not.toContain("bg-primary");
    expect(cls).not.toContain("text-primary-foreground");
    expect(cls).not.toContain("h-8");
  });

  it("all pre-2.15 variants and sizes still resolve", () => {
    for (const variant of ["default", "outline", "secondary", "ghost", "destructive", "link"] as const) {
      for (const size of ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"] as const) {
        expect(buttonVariants({ variant, size })).toContain("inline-flex");
      }
    }
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-secondary");
    expect(buttonVariants({ variant: "ghost" })).toContain("hover:bg-muted");
    expect(buttonVariants({ variant: "destructive" })).toContain("text-destructive");
    expect(buttonVariants({ variant: "link" })).toContain("underline-offset-4");
  });
});
