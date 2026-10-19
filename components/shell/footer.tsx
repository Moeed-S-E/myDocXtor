import Link from "next/link";
import { InstallOffline } from "./install-offline";

const VERSION = "0.1.0";

/** Footer with privacy, licenses, shortcuts, version (UI steering §3.2). */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-border px-4 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <nav className="flex flex-wrap gap-4">
          <Link href="/privacy/" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/licenses/" className="hover:text-foreground">
            Licenses
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <InstallOffline />
          <p className="font-mono text-xs">v{VERSION}</p>
        </div>
      </div>
    </footer>
  );
}
