import type { Metadata } from "next";
import { Fraunces, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const bodySans = Noto_Sans_JP({
  variable: "--font-body-sans",
  subsets: ["latin"],
});

const displaySerif = Fraunces({
  variable: "--font-display-serif",
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
  return (
    <html
      lang="en"
      className={`${bodySans.variable} ${displaySerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
