import type { Metadata } from "next";
import "./fonts/static/pretendard-jp.css";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "DM Note - V-ARCHIVE Recap",
  description: "한 해 동안의 기록을 되돌아보는 시간"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
