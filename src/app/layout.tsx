import type { Metadata } from "next";
import { Archivo_Black, Noto_Sans_JP, Noto_Serif_JP, Space_Grotesk } from "next/font/google";
import AppFooter from "./AppFooter";
import "./globals.css";

const bodySans = Space_Grotesk({
  variable: "--font-body-sans",
  subsets: ["latin"],
});

const displaySans = Archivo_Black({
  variable: "--font-display-sans",
  weight: "400",
  subsets: ["latin"],
});

const jpSans = Noto_Sans_JP({
  variable: "--font-jp-sans",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const jpSerif = Noto_Serif_JP({
  variable: "--font-jp-serif",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WaniRanks",
  description: "Family WaniKani leaderboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const bootPreferencesScript = `(() => {
    try {
      const font = localStorage.getItem("wr:jp-font");
      const fontMode = font === "serif" ? "serif" : "sans";
      document.documentElement.setAttribute("data-jp-font", fontMode);
    } catch {}

    try {
      const theme = localStorage.getItem("wr:theme");
      const themeMode = theme === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", themeMode);
    } catch {
      document.documentElement.setAttribute("data-theme", "light");
    }
  })();`;

  return (
    <html
      lang="en"
      className={`${bodySans.variable} ${displaySans.variable} ${jpSans.variable} ${jpSerif.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootPreferencesScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <main className="flex-1">{children}</main>
        <AppFooter />
      </body>
    </html>
  );
}
