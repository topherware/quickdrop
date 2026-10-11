import type { Metadata, Viewport } from "next";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "./globals.css";
import { LanguageProvider } from "@/components/language";
export const metadata: Metadata = {
  title: "QuickDrop — Your files. Any device.",
  description:
    "Share files across devices without signing up. Send files, share a code or QR, and download.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  themeColor: "#080c1c",
  colorScheme: "dark",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
