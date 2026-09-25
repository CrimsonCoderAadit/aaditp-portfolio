import type { Metadata, Viewport } from "next";
import { Syne } from "next/font/google";
import "./globals.css";

// The hero name's display face: a variable font whose weight axis (400–800) also widens the glyphs.
const display = Syne({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "Aadit Praveen Nath — Software Engineer",
  description: "Aadit Praveen Nath · Software Engineer · AI · Systems",
};

export const viewport: Viewport = { themeColor: "#191b1d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={display.variable}><body>{children}</body></html>;
}
