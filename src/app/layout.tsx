import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const body = Noto_Sans_KR({
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "V-ARCHIVE Recap 2025",
  description: "Simple recap for V-ARCHIVE records."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={body.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
