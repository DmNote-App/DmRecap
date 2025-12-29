"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return prefersReducedMotion;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnMount: false, // 이미 캐시된 데이터가 있으면 재요청 안함
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5분간 fresh 상태 유지
            gcTime: 30 * 60 * 1000, // 30분간 캐시 유지
          },
        },
      })
  );
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasNickname = Boolean(searchParams?.get("nickname"));
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }
    if (pathname === "/" && !hasNickname) {
      return;
    }

    let lenis: { raf: (time: number) => void; destroy: () => void } | null =
      null;
    let rafId: number | null = null;
    let cancelled = false;

    const start = async () => {
      const { default: Lenis } = await import("lenis");
      if (cancelled) return;
      lenis = new Lenis();
      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    };

    void start();

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      lenis?.destroy();
    };
  }, [pathname, hasNickname, prefersReducedMotion]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
