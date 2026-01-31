import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Coffee } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-lg">
        <div className="flex items-center justify-center gap-3">
          <Coffee className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold">B-Ledger</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Track team mistakes, count bars, and manage breakfast obligations.
          5 bars = 1 breakfast.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/login">
            <Button size="lg">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline">
              Create account
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
