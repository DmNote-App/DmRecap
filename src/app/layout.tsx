import type { Metadata } from "next";
import "./fonts/static/pretendard-jp.css";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "DM Note - V-ARCHIVE Recap",
  description: "한 해 동안의 기록을 되돌아보는 시간"
};

// 테마 초기화 스크립트 - CSS 파싱 전에 실행되어야 FOUC(깜빡임) 방지
const themeInitScript = `
(function() {
  try {
    var key = "recap-theme";
    var stored = localStorage.getItem(key);
    var theme = stored === "dark" ? "dark" : "light";
    var root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
