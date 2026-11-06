import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactFormSection } from "@/components/landing/ContactFormSection";
import { submitContactForm } from "@/lib/actions/contact";

/**
 * משימה 2.15 — בדיקות משלימות (tester) לעיצוב המחודש של טופס השארת הפרטים:
 * ולידציה (aria-invalid + aria-describedby), שדות חובה, מצב שליחה (disabled + spinner),
 * ומצבי הצלחה/שגיאה עם טוקני success-light/error-light (תיקון ניגודיות 2.10).
 * ה-Server Action ממוקק — אין כתיבה למסד הנתונים. אין נתוני אמת.
 */
vi.mock("@/lib/actions/contact", () => ({
  submitContactForm: vi.fn(),
}));

const treatments = [{ id: "t1", name: "טיפול לדוגמה" }];
const mock = vi.mocked(submitContactForm);

beforeEach(() => {
  mock.mockReset();
  mock.mockResolvedValue({ ok: true });
});

const submit = () => screen.getByRole("button", { name: "שליחת פרטים" });

describe("ContactFormSection — validation a11y (2.15)", () => {
  it("invalid Israeli phone: error text, aria-invalid=true and aria-describedby → error element", async () => {
    const user = userEvent.setup();
    render(<ContactFormSection treatments={treatments} />);
    await user.type(screen.getByLabelText(/שם מלא/), "בדיקה");
    const phone = screen.getByLabelText(/טלפון/);
    expect(phone).toHaveAttribute("aria-invalid", "false");
    expect(phone).not.toHaveAttribute("aria-describedby");

    await user.type(phone, "12345");
    await user.click(submit());

    const err = await screen.findByText(
      "מספר טלפון לא תקין — נא להזין מספר ישראלי תקין (לדוגמה: 050-1234567)"
    );
    expect(phone).toHaveAttribute("aria-invalid", "true");
    const describedBy = phone.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(err.id).toBe(describedBy);
    expect(phone).toHaveAccessibleDescription(/מספר טלפון לא תקין/);
    expect(err.className).toContain("text-error-light");
    // שם תקין — אין שגיאה עליו
    expect(screen.getByLabelText(/שם מלא/)).toHaveAttribute("aria-invalid", "false");
    expect(mock).not.toHaveBeenCalled();
  });

  it("required fields: empty submit shows both required errors, linked via aria-describedby", async () => {
    const user = userEvent.setup();
    render(<ContactFormSection treatments={treatments} />);
    await user.click(submit());

    const name = screen.getByLabelText(/שם מלא/);
    const phone = screen.getByLabelText(/טלפון/);
    expect(await screen.findByText("נא להזין שם מלא")).toBeInTheDocument();
    expect(screen.getByText("נא להזין מספר טלפון")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("נא להזין שם מלא");
    expect(phone).toHaveAccessibleDescription("נא להזין מספר טלפון");
    expect(name).toHaveAttribute("aria-required", "true");
    expect(phone).toHaveAttribute("aria-required", "true");
    // שדות אופציונליים אינם מסומנים כחובה
    expect(screen.getByLabelText("הערה")).not.toHaveAttribute("aria-required");
    expect(mock).not.toHaveBeenCalled();
  });

  it("valid Israeli formats (+972 / spaces-dashes) pass client validation", async () => {
    const user = userEvent.setup();
    render(<ContactFormSection treatments={treatments} />);
    await user.type(screen.getByLabelText(/שם מלא/), "בדיקה");
    await user.type(screen.getByLabelText(/טלפון/), "+972-50-000-0000");
    await user.click(submit());
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("fields keep names/types/placeholders; phone is dir=ltr type=tel; inputs use 17px token class", () => {
    render(<ContactFormSection treatments={treatments} />);
    const name = screen.getByLabelText(/שם מלא/);
    const phone = screen.getByLabelText(/טלפון/);
    expect(name).toHaveAttribute("name", "name");
    expect(name).toHaveAttribute("placeholder", "לדוגמה: דנה כהן");
    expect(phone).toHaveAttribute("name", "phone");
    expect(phone).toHaveAttribute("type", "tel");
    expect(phone).toHaveAttribute("dir", "ltr");
    expect(phone).toHaveAttribute("placeholder", "050-1234567");
    expect(screen.getByLabelText("טיפול מבוקש")).toHaveAttribute("name", "treatmentId");
    expect(screen.getByLabelText("הערה")).toHaveAttribute("name", "note");
    for (const el of [name, phone, screen.getByLabelText("טיפול מבוקש"), screen.getByLabelText("הערה")]) {
      expect(el.className).toContain("text-(length:--type-body)");
      expect(el.className).toContain("md:text-(length:--type-body)");
      expect(el.className).not.toMatch(/(^|\s)md:text-sm(\s|$)/);
    }
  });
});

describe("ContactFormSection — submit pending state (2.15)", () => {
  it("while pending: button disabled, label 'שולח...', spinner with motion-reduce:animate-none", async () => {
    let resolve!: (v: { ok: true }) => void;
    mock.mockImplementation(() => new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    const { container } = render(<ContactFormSection treatments={treatments} />);
    await user.type(screen.getByLabelText(/שם מלא/), "בדיקה");
    await user.type(screen.getByLabelText(/טלפון/), "0500000000");
    await user.click(submit());

    const pending = await screen.findByRole("button", { name: "שולח..." });
    expect(pending).toBeDisabled();
    const spinner = pending.querySelector("svg");
    expect(spinner).not.toBeNull();
    const cls = spinner!.getAttribute("class") ?? "";
    expect(cls).toContain("animate-spin");
    expect(cls).toContain("motion-reduce:animate-none");
    expect(spinner).toHaveAttribute("aria-hidden", "true");

    resolve({ ok: true });
    expect(await screen.findByRole("status")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "שליחת פרטים" });
    expect(btn).not.toBeDisabled();
    expect(btn.querySelector("svg")).toBeNull();
    expect(container.querySelector("[data-contact-form-submit]")).toBe(btn);
  });
});

describe("ContactFormSection — success / error states (2.15)", () => {
  it("success: role=status, success-light tokens, exact text, fields reset", async () => {
    const user = userEvent.setup();
    render(<ContactFormSection treatments={treatments} />);
    await user.type(screen.getByLabelText(/שם מלא/), "בדיקה");
    await user.type(screen.getByLabelText(/טלפון/), "0500000000");
    await user.click(submit());

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("הפרטים נשלחו בהצלחה! ניצור איתך קשר בהקדם.");
    expect(status.className).toContain("text-success-light");
    expect(status.className).toContain("border-success-light");
    expect(status.className).not.toMatch(/(^|\s)text-success(\s|$)/);
    expect(status).toHaveAttribute("data-contact-form-status", "success");
    expect(within(status).getByText(/הפרטים נשלחו/).tagName).toBe("SPAN");
    expect(status.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByLabelText(/שם מלא/)).toHaveValue("");
    expect(screen.getByLabelText(/טלפון/)).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("server error: role=alert, error-light tokens, server message shown", async () => {
    mock.mockResolvedValue({ ok: false, message: "הודעת שגיאה מהשרת" });
    const user = userEvent.setup();
    render(<ContactFormSection treatments={treatments} />);
    await user.type(screen.getByLabelText(/שם מלא/), "בדיקה");
    await user.type(screen.getByLabelText(/טלפון/), "0500000000");
    await user.click(submit());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("הודעת שגיאה מהשרת");
    expect(alert.className).toContain("text-error-light");
    expect(alert.className).toContain("border-error-light");
    expect(alert.className).not.toMatch(/(^|\s)text-destructive(\s|$)/);
    expect(alert).toHaveAttribute("data-contact-form-status", "error");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // הערכים נשמרים לאחר כישלון
    expect(screen.getByLabelText(/טלפון/)).toHaveValue("0500000000");
  });

  it("thrown error: generic Hebrew error message (unchanged text)", async () => {
    mock.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<ContactFormSection treatments={treatments} />);
    await user.type(screen.getByLabelText(/שם מלא/), "בדיקה");
    await user.type(screen.getByLabelText(/טלפון/), "0500000000");
    await user.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "אירעה שגיאה בשליחת הפרטים. נא לנסות שוב מאוחר יותר."
    );
    expect(screen.getByRole("button", { name: "שליחת פרטים" })).not.toBeDisabled();
  });

  it("required asterisks and field errors use error-light (not text-destructive)", async () => {
    const user = userEvent.setup();
    const { container } = render(<ContactFormSection treatments={treatments} />);
    await user.click(submit());
    await screen.findByText("נא להזין שם מלא");
    expect(container.querySelector(".text-destructive")).toBeNull();
    expect(container.querySelector(".text-success")).toBeNull();
    const stars = [...container.querySelectorAll("label span")].filter((s) => s.textContent === "*");
    expect(stars).toHaveLength(2);
    for (const s of stars) expect(s.className).toContain("text-error-light");
  });
});
