import type { Metadata } from "next";
import Script from "next/script";
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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var key="recap-theme";var stored=localStorage.getItem(key);var theme=stored==="dark"?"dark":"light";var root=document.documentElement;if(theme==="dark"){root.classList.add("dark");}else{root.classList.remove("dark");}root.dataset.theme=theme;root.style.colorScheme=theme;}catch(e){}})();`}
        </Script>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
