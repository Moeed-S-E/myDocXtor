import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CONTENT_SECURITY_POLICY_META } from "@/lib/csp";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { Header } from "@/components/shell/header";
import { Footer } from "@/components/shell/footer";
import { ServiceWorkerRegistrar } from "@/components/shell/service-worker-registrar";

// Fonts are provided by self-contained system font stacks defined as CSS
// variables in globals.css. No third-party font CDN is contacted at build or
// runtime (design §6: self-host / no third-party fonts). To ship a branded
// variable font later, drop its .woff2 into /public/fonts and switch to
// next/font/local — still fully self-hosted.

export const metadata: Metadata = {
  title: "myDocXtor — Every PDF tool. Nothing leaves your device.",
  description:
    "A complete PDF toolkit plus an AI background remover. Every file is processed inside your browser; no file ever leaves the device.",
  applicationName: "myDocXtor",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  appleWebApp: { capable: true, title: "myDocXtor", statusBarStyle: "default" },
  verification: {
    google: "1e6y_gl7PxEFmFDhLWD7HA6O3N1VdJEzszQkfhRlkfI",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Portable CSP fallback; the static host should ALSO set this as a header (design §6). */}
        <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY_META} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
