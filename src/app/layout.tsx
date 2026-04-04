import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk } from "next/font/google";
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
      className={`${bodySans.variable} ${displaySans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
