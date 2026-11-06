import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactFormSection } from "./ContactFormSection";
import { submitContactForm } from "@/lib/actions/contact";

vi.mock("@/lib/actions/contact", () => ({
  submitContactForm: vi.fn(),
}));

const treatments = [{ id: "t1", name: "טיפול פנים" }];

describe("ContactFormSection", () => {
  const submitContactFormMock = vi.mocked(submitContactForm);

  beforeEach(() => {
    submitContactFormMock.mockReset();
    submitContactFormMock.mockResolvedValue({ ok: true });
  });

  it("תיבת ההסכמה אינה מסומנת כברירת מחדל", () => {
    render(<ContactFormSection treatments={treatments} />);
    const consentCheckbox = screen.getByRole("checkbox");
    expect(consentCheckbox).not.toBeChecked();
  });

  it("שליחה עם טלפון לא תקין מציגה שגיאת ולידציה וחוסמת שליחה", async () => {
    const user = userEvent.setup();
    render(<ContactFormSection treatments={treatments} />);

    await user.type(screen.getByLabelText(/שם מלא/), "דנה כהן");
    await user.type(screen.getByLabelText(/טלפון/), "12345");
    await user.click(screen.getByRole("button", { name: "שליחת פרטים" }));

    expect(
      await screen.findByText(/מספר טלפון לא תקין/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(submitContactFormMock).not.toHaveBeenCalled();
  });

  it("טופס תקין עם שם וטלפון תקינים עובר ולידציה ומציג הודעת הצלחה", async () => {
    const user = userEvent.setup();
    render(<ContactFormSection treatments={treatments} />);

    await user.type(screen.getByLabelText(/שם מלא/), "דנה כהן");
    await user.type(screen.getByLabelText(/טלפון/), "0501234567");
    await user.click(screen.getByRole("button", { name: "שליחת פרטים" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "הפרטים נשלחו בהצלחה"
    );
    expect(submitContactFormMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "דנה כהן", phone: "0501234567" })
    );
  });

  it("כאשר השרת מחזיר שגיאה, מוצגת הודעת שגיאה בעברית ולא הודעת הצלחה", async () => {
    submitContactFormMock.mockResolvedValue({
      ok: false,
      message: "אירעה שגיאה בשליחת הפרטים. נא לנסות שוב מאוחר יותר.",
    });
    const user = userEvent.setup();
    render(<ContactFormSection treatments={treatments} />);

    await user.type(screen.getByLabelText(/שם מלא/), "דנה כהן");
    await user.type(screen.getByLabelText(/טלפון/), "0501234567");
    await user.click(screen.getByRole("button", { name: "שליחת פרטים" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "אירעה שגיאה בשליחת הפרטים"
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
