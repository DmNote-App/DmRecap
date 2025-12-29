"use client";

import { useState, useRef, useCallback, RefObject } from "react";
import html2canvas from "html2canvas";
import * as htmlToImage from "html-to-image";

// 프록시 환경에서는 상대 경로 사용 (동일 출처)

// 비디오 대체 정보 타입
type VideoReplacement = {
  video: HTMLVideoElement;
  img: HTMLImageElement | null;
  parent: HTMLElement;
};

type OriginalImageState = {
  src: string;
  srcset: string | null;
  sizes: string | null;
  loading: string | null;
};

// 이미지 저장 옵션 타입
type SaveImageOptions = {
  fileName: string;
  backgroundColor?: string;
  pixelRatio?: number;
  onBeforeCapture?: () => void | Promise<void>;
  onAfterCapture?: () => void | Promise<void>;
};

// video 요소를 canvas 이미지로 대체하는 함수 (Safari 모바일 대응)
const replaceVideosWithImages = (element: HTMLElement): VideoReplacement[] => {
  const videos = element.querySelectorAll("video");
  const replacements: VideoReplacement[] = [];

  videos.forEach((video) => {
    const parent = video.parentElement;
    if (!parent) return;

    try {
      // video가 충분히 로드되었는지 확인
      if (video.readyState < 2) {
        // 로드가 안된 경우 비디오 숨기고 placeholder 사용
        const placeholder = document.createElement("div");
        placeholder.style.width = "100%";
        placeholder.style.height = "100%";
        placeholder.style.backgroundColor = "#1a1a1a";
        placeholder.style.borderRadius = "inherit";
        placeholder.setAttribute("data-video-placeholder", "true");

        parent.insertBefore(placeholder, video);
        video.style.display = "none";
        replacements.push({
          video,
          img: placeholder as unknown as HTMLImageElement,
          parent,
        });
        return;
      }

      const canvas = document.createElement("canvas");
      // 실제 비디오 해상도 또는 표시 크기 사용
      const width = video.videoWidth || video.offsetWidth || 80;
      const height = video.videoHeight || video.offsetHeight || 80;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // 비디오 프레임을 canvas에 그리기
        ctx.drawImage(video, 0, 0, width, height);

        let dataUrl: string;
        try {
          dataUrl = canvas.toDataURL("image/png");
        } catch (canvasError) {
          // CORS 또는 보안 오류 시 fallback
          console.warn("Canvas toDataURL 실패 (CORS?):", canvasError);
          dataUrl = "";
        }

        if (dataUrl && dataUrl !== "data:,") {
          const img = document.createElement("img");
          img.src = dataUrl;
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          img.style.borderRadius = "inherit";
          img.className = video.className;

          parent.insertBefore(img, video);
          video.style.display = "none";
          replacements.push({ video, img, parent });
        } else {
          // dataUrl이 비어있으면 그냥 비디오 숨기기
          video.style.display = "none";
          replacements.push({ video, img: null, parent });
        }
      }
    } catch (e) {
      console.warn("비디오 캡처 실패:", e);
      // 실패해도 비디오를 숨기지 않고 그대로 둠
    }
  });

  return replacements;
};

// video 요소 복원 함수
const restoreVideos = (replacements: VideoReplacement[]) => {
  replacements.forEach(({ video, img, parent }) => {
    video.style.display = "";
    if (img && parent.contains(img)) {
      parent.removeChild(img);
    }
    // placeholder div도 제거
    const placeholder = parent.querySelector("[data-video-placeholder]");
    if (placeholder) {
      parent.removeChild(placeholder);
    }
  });
};

// 이미지 원본 복원 함수
const restoreOriginalImages = (
  originalSrcs: Map<HTMLImageElement, OriginalImageState>
) => {
  originalSrcs.forEach((state, img) => {
    img.src = state.src;
    if (state.srcset !== null) {
      img.setAttribute("srcset", state.srcset);
    } else {
      img.removeAttribute("srcset");
    }
    if (state.sizes !== null) {
      img.setAttribute("sizes", state.sizes);
    } else {
      img.removeAttribute("sizes");
    }
    if (state.loading !== null) {
      img.setAttribute("loading", state.loading);
    } else {
      img.removeAttribute("loading");
    }
  });
};

// 이미지 placeholder (로드 실패 시 사용)
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNFNUU4RUIiLz48L3N2Zz4=";
const CAPTURE_DESKTOP_MIN_WIDTH = 1024;
const CAPTURE_SIDE_PADDING = 40;

/**
 * 이미지 저장 기능을 제공하는 커스텀 훅
 * html-to-image를 사용하여 크로스 플랫폼 호환성 보장 (Windows, Mac, iOS, Android)
 */
export function useImageSaver() {
  const [isSaving, setIsSaving] = useState(false);
  // 이미지 base64 캐시 (중복 요청 방지)
  const imageCache = useRef<Map<string, string>>(new Map());
  const fontEmbedCSSCache = useRef<Map<string, string>>(new Map());

  // 이미지를 프록시를 통해 base64로 변환하는 함수
  const convertExternalImages = useCallback(
    async (
      element: HTMLElement
    ): Promise<Map<HTMLImageElement, OriginalImageState>> => {
      const originalSrcs = new Map<HTMLImageElement, OriginalImageState>();
      const images = element.querySelectorAll("img");

      const applyReplacement = (img: HTMLImageElement, dataUrl: string) => {
        img.src = dataUrl;
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        img.setAttribute("loading", "eager");
      };

      const promises = Array.from(images).map(async (img) => {
        const currentSrc = img.currentSrc || img.src;
        if (!currentSrc || currentSrc.startsWith("data:")) {
          return;
        }

        const isNextImage =
          img.dataset.nimg === "1" || currentSrc.includes("/_next/image");
        const isSameOrigin = currentSrc.startsWith(window.location.origin);
        if (isSameOrigin && !isNextImage) {
          return;
        }

        // 원본 src 저장
        originalSrcs.set(img, {
          src: img.src,
          srcset: img.getAttribute("srcset"),
          sizes: img.getAttribute("sizes"),
          loading: img.getAttribute("loading"),
        });

        let sourceUrl = currentSrc;
        if (isNextImage) {
          try {
            const parsed = new URL(currentSrc, window.location.origin);
            sourceUrl = parsed.searchParams.get("url") ?? currentSrc;
          } catch {
            sourceUrl = currentSrc;
          }
        }
        const sourceOrigin = new URL(sourceUrl, window.location.origin).origin;
        const shouldProxy = sourceOrigin !== window.location.origin;
        const cacheKey = sourceUrl;

        // 캐시에 있으면 재사용 (중복 API 요청 방지)
        const cached = imageCache.current.get(cacheKey);
        if (cached) {
          applyReplacement(img, cached);
          return;
        }

        try {
          // basePath가 /recap이므로 API 경로도 /recap/api/...로 요청
          const fetchUrl = shouldProxy
            ? `/recap/api/image-proxy?url=${encodeURIComponent(sourceUrl)}`
            : sourceUrl;
          const response = await fetch(fetchUrl);

          if (!response.ok) throw new Error("Proxy failed");

          const blob = await response.blob();

          // FileReader로 base64 변환
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // 캐시에 저장
          imageCache.current.set(cacheKey, dataUrl);
          applyReplacement(img, dataUrl);
        } catch {
          console.warn("이미지 변환 실패:", sourceUrl);
          // 실패시 회색 placeholder로 대체
          imageCache.current.set(cacheKey, IMAGE_PLACEHOLDER);
          applyReplacement(img, IMAGE_PLACEHOLDER);
        }
      });

      await Promise.all(promises);
      return originalSrcs;
    },
    []
  );

  const waitForFonts = useCallback(async () => {
    if (typeof document === "undefined" || !document.fonts) return;

    try {
      await document.fonts.ready;
      await Promise.all([
        document.fonts.load('400 1em "Pretendard JP"'),
        document.fonts.load('500 1em "Pretendard JP"'),
        document.fonts.load('600 1em "Pretendard JP"'),
        document.fonts.load('700 1em "Pretendard JP"'),
      ]);
    } catch (error) {
      console.warn("폰트 로딩 대기 실패:", error);
    }

    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  }, []);

  const getFontEmbedCSS = useCallback(
    async (element: HTMLElement, preferredFontFormat: string) => {
      const cached = fontEmbedCSSCache.current.get(preferredFontFormat);
      if (cached) return cached;

      try {
        const css = await htmlToImage.getFontEmbedCSS(element, {
          preferredFontFormat,
        });
        fontEmbedCSSCache.current.set(preferredFontFormat, css);
        return css;
      } catch (error) {
        console.warn("폰트 임베딩 CSS 생성 실패:", error);
        return "";
      }
    },
    []
  );

  // 요소를 이미지로 저장하는 함수
  const saveAsImage = useCallback(
    async (elementRef: RefObject<HTMLElement>, options: SaveImageOptions) => {
      if (!elementRef.current || isSaving) return;

      setIsSaving(true);
      const element = elementRef.current;
      const captureContainer =
        element.querySelector<HTMLElement>(".recap-container");
      const originalScroll = {
        x: window.scrollX,
        y: window.scrollY,
      };
      const originalBodyStyles = {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight,
      };
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      const originalInlineStyles = {
        width: element.style.width,
        maxWidth: element.style.maxWidth,
        minWidth: element.style.minWidth,
        boxSizing: element.style.boxSizing,
      };
      let originalSrcs: Map<HTMLImageElement, OriginalImageState> | null = null;
      let videoReplacements: VideoReplacement[] = [];

      try {
        document.documentElement.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${originalScroll.y}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
        if (options.onBeforeCapture) {
          await options.onBeforeCapture();
        }
        element.classList.add("capture-mode");
        await new Promise((resolve) =>
          requestAnimationFrame(() => resolve(null))
        );
        await new Promise((resolve) =>
          requestAnimationFrame(() => resolve(null))
        );

        if (captureContainer) {
          const captureContainerWidth =
            captureContainer.getBoundingClientRect().width;
          const targetWidth = Math.max(
            captureContainerWidth,
            CAPTURE_DESKTOP_MIN_WIDTH
          );
          element.style.boxSizing = "border-box";
          element.style.maxWidth = "none";
          element.style.minWidth = "0";
          element.style.width = `${Math.ceil(
            targetWidth + CAPTURE_SIDE_PADDING * 2
          )}px`;
        }

        // 페이지 스크롤을 맨 위로 이동
        window.scrollTo(0, 0);

        // video 요소를 이미지로 대체 (Safari 모바일 대응) - 먼저 실행
        try {
          videoReplacements = replaceVideosWithImages(element);
        } catch (videoError) {
          console.warn("비디오 대체 실패, 계속 진행:", videoError);
        }

        // 외부 이미지를 base64로 변환 (병렬 처리됨)
        try {
          originalSrcs = await convertExternalImages(element);
        } catch (imgError) {
          console.warn("외부 이미지 변환 실패, 계속 진행:", imgError);
        }

        // 렌더링 완료 대기
        await waitForFonts();
        const fontEmbedCSS = await getFontEmbedCSS(element, "woff2");
        await new Promise((resolve) => setTimeout(resolve, 100));

        let dataUrl = "";

        try {
          // html-to-image를 사용하여 캡처 (크로스 플랫폼 호환성 우수)
          dataUrl = await htmlToImage.toPng(element, {
            quality: 1.0,
            pixelRatio: options.pixelRatio ?? 3,
            backgroundColor: options.backgroundColor ?? "#f2f4f6",
            preferredFontFormat: "woff2",
            fontEmbedCSS: fontEmbedCSS || undefined,
            cacheBust: true,
            imagePlaceholder: IMAGE_PLACEHOLDER,
            filter: (node) => {
              return !(node instanceof HTMLVideoElement);
            },
          });
        } catch (htmlError) {
          console.warn("html-to-image 실패, html2canvas로 재시도:", htmlError);
          const canvas = await html2canvas(element, {
            scale: options.pixelRatio ?? 3,
            backgroundColor: options.backgroundColor ?? "#f2f4f6",
            useCORS: true,
            allowTaint: false,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            ignoreElements: (node) => node instanceof HTMLVideoElement,
          });
          dataUrl = canvas.toDataURL("image/png", 1.0);
        }

        // 다운로드 링크 생성
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = options.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error("이미지 저장 중 오류가 발생했습니다:", error);
        if (error instanceof Error) {
          console.error("Error name:", error.name);
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }
        alert("이미지 저장에 실패했습니다. 다시 시도해주세요.");
      } finally {
        // 원본 이미지 복원
        if (originalSrcs) {
          restoreOriginalImages(originalSrcs);
        }
        // video 요소 복원
        if (videoReplacements.length > 0) {
          restoreVideos(videoReplacements);
        }
        element.classList.remove("capture-mode");
        if (options.onAfterCapture) {
          await options.onAfterCapture();
        }
        document.body.style.position = originalBodyStyles.position;
        document.body.style.top = originalBodyStyles.top;
        document.body.style.left = originalBodyStyles.left;
        document.body.style.right = originalBodyStyles.right;
        document.body.style.width = originalBodyStyles.width;
        document.body.style.overflow = originalBodyStyles.overflow;
        document.body.style.paddingRight = originalBodyStyles.paddingRight;
        document.documentElement.style.overflow = originalHtmlOverflow;
        window.scrollTo(originalScroll.x, originalScroll.y);
        element.style.width = originalInlineStyles.width;
        element.style.maxWidth = originalInlineStyles.maxWidth;
        element.style.minWidth = originalInlineStyles.minWidth;
        element.style.boxSizing = originalInlineStyles.boxSizing;
        setIsSaving(false);
      }
    },
    [isSaving, convertExternalImages, waitForFonts, getFontEmbedCSS]
  );

  // 캐시 초기화 함수
  const clearCache = useCallback(() => {
    imageCache.current.clear();
    fontEmbedCSSCache.current.clear();
  }, []);

  return {
    isSaving,
    saveAsImage,
    clearCache,
  };
}
