import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "RoadEye AI",
  description:
    "Startupowa platforma monitoringu stanu dróg w Polsce — satelita, AI Vision, GIS.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body
        className={`${sans.variable} ${mono.variable} bg-[#eef1f4] font-sans text-[#111827] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
