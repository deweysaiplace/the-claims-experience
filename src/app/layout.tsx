import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Claims Experience",
  description: "Insurance Adjuster Toolkit — Estimate Reconciliation & Field Tools",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Claims Experience" },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b", // zinc-950
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Claims Experience" />
      </head>
      <body className="min-h-full bg-zinc-950 text-white">
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
            // /sw.js has never existed -- next-pwa was installed but never
            // wired into next.config.ts, so this registration always 404'd.
            // If a service worker somehow got installed anyway from an
            // earlier deploy, an already-installed one keeps running from
            // its cached script indefinitely; the browser does not drop it
            // just because the endpoint now 404s. That means a phone can be
            // silently served stale JS from months ago no matter what ships
            // today. Actively unregister and clear caches instead of trying
            // to register, so this can't happen again.
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(regs) {
                regs.forEach(function(reg) { reg.unregister(); });
              });
            }
            if ('caches' in window) {
              caches.keys().then(function(names) {
                names.forEach(function(name) { caches.delete(name); });
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
