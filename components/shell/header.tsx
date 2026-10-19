import Link from "next/link";
import { FileLock2 } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { PrivacyBadge } from "./privacy-badge";
import { ThemeToggle } from "./theme-toggle";

/** Sticky 56px header (UI steering §3.2). */
export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur">
      <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
        <FileLock2 className="size-5 text-primary" />
        <span>myDocXtor</span>
      </Link>
      <div className="flex flex-1 justify-center">
        <CommandPalette />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PrivacyBadge />
        <ThemeToggle />
      </div>
    </header>
  );
}
