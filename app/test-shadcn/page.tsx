import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TestShadcnPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">בדיקת shadcn/ui</h1>
      <p className="text-muted-foreground">
        דף בדיקה זמני לוידוא שרכיב Button מיובא ומוצג ללא שגיאות build.
      </p>
      <Button>כפתור לדוגמה</Button>
      <Button variant="outline">
        המשך
        <ArrowLeft className="rtl:rotate-180" />
      </Button>
    </div>
  );
}
