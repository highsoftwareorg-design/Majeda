import { redirect } from "next/navigation";

import { auth, signIn } from "@/lib/auth/auth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;

  if (session) {
    redirect(callbackUrl ?? "/clients");
  }

  async function authenticate(formData: FormData) {
    "use server";

    const email = formData.get("email");
    const password = formData.get("password");
    const target = formData.get("callbackUrl");

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: typeof target === "string" && target ? target : "/clients",
      });
    } catch (err) {
      // NEXT_REDIRECT is thrown by Auth.js on success — let it propagate.
      if (err instanceof Error && err.message === "NEXT_REDIRECT") {
        throw err;
      }
      redirect(
        `/login?error=CredentialsSignin${target ? `&callbackUrl=${encodeURIComponent(String(target))}` : ""}`
      );
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen w-full items-center justify-center bg-ink px-4 py-10"
    >
      <Card className="w-full max-w-sm border-taupe/30 bg-charcoal text-white">
        <CardHeader className="items-center gap-2 text-center">
          <Logo variant="transparent" size={140} />
          <CardTitle className="font-heading text-xl text-white">
            כניסה לממשק הניהול
          </CardTitle>
          <CardDescription className="text-gold-light">
            MAJIDA Beauté Center — כניסה לצוות המרפאה בלבד
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={authenticate} className="flex flex-col gap-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-white">
                אימייל
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="example@majida.co.il"
                className="bg-white text-charcoal"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-white">
                סיסמה
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="bg-white text-charcoal"
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-error">
                אימייל או סיסמה שגויים. נסו שוב.
              </p>
            ) : null}

            <Button type="submit" className="mt-2 w-full bg-gold text-ink hover:bg-gold-light">
              התחברות
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
