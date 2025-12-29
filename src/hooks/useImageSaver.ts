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

type CachedImage =
  | { kind: "blob"; blob: Blob }
  | { kind: "dataUrl"; dataUrl: string };

type ExternalImageConversionResult = {
  originalSrcs: Map<HTMLImageElement, OriginalImageState>;
  objectUrls: string[];
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

const revokeObjectUrls = (objectUrls: string[]) => {
  objectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("Object URL 해제 실패:", error);
    }
  });
};

// 이미지 placeholder (로드 실패 시 사용)
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNFNUU4RUIiLz48L3N2Zz4=";
const CAPTURE_DESKTOP_MIN_WIDTH = 1024;
const CAPTURE_SIDE_PADDING = 40;
const CAPTURE_FONT_FAMILY = '"Pretendard JP"';
const CAPTURE_FONT_WEIGHTS = [400, 500, 600, 700];
const CAPTURE_MAX_FONT_WAIT_MS = 2000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const stripLocalFontSources = (cssText: string) => {
  return cssText.replace(/src:\s*([^;]+);/g, (match, srcValue) => {
    const cleaned = srcValue
      .split(",")
      .map((part: string) => part.trim())
      .filter((part: string) => !part.startsWith("local("))
      .join(", ");
    return cleaned ? `src: ${cleaned};` : match;
  });
};

/**
 * 이미지 저장 기능을 제공하는 커스텀 훅
 * html-to-image를 사용하여 크로스 플랫폼 호환성 보장 (Windows, Mac, iOS, Android)
 */
export function useImageSaver() {
  const [isSaving, setIsSaving] = useState(false);
  // 이미지 Blob 캐시 (중복 요청 방지, base64 메모리 절감)
  const imageCache = useRef<Map<string, CachedImage>>(new Map());
  const fontEmbedCSSCache = useRef<Map<string, string>>(new Map());

  // 이미지를 프록시를 통해 Blob/Object URL로 변환하는 함수
  const convertExternalImages = useCallback(
    async (
      element: HTMLElement
    ): Promise<ExternalImageConversionResult> => {
      const originalSrcs = new Map<HTMLImageElement, OriginalImageState>();
      const objectUrls: string[] = [];
      const images = element.querySelectorAll("img");

      const applyReplacement = (img: HTMLImageElement, dataUrl: string) => {
        img.src = dataUrl;
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        img.setAttribute("loading", "eager");
      };

      const applyBlobReplacement = (img: HTMLImageElement, blob: Blob) => {
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.push(objectUrl);
        applyReplacement(img, objectUrl);
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
          if (cached.kind === "blob") {
            applyBlobReplacement(img, cached.blob);
          } else {
            applyReplacement(img, cached.dataUrl);
          }
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

          // 캐시에 저장
          imageCache.current.set(cacheKey, { kind: "blob", blob });
          applyBlobReplacement(img, blob);
        } catch {
          console.warn("이미지 변환 실패:", sourceUrl);
          // 실패시 회색 placeholder로 대체
          imageCache.current.set(cacheKey, {
            kind: "dataUrl",
            dataUrl: IMAGE_PLACEHOLDER,
          });
          applyReplacement(img, IMAGE_PLACEHOLDER);
        }
      });

      await Promise.all(promises);
      return { originalSrcs, objectUrls };
    },
    []
  );

  const waitForFonts = useCallback(async () => {
    if (typeof document === "undefined" || !document.fonts) return;

    try {
      await document.fonts.ready;
      await Promise.all(
        CAPTURE_FONT_WEIGHTS.map((weight) =>
          document.fonts.load(`${weight} 1em ${CAPTURE_FONT_FAMILY}`)
        )
      );
    } catch (error) {
      console.warn("폰트 로딩 대기 실패:", error);
    }

    const startTime = Date.now();
    while (Date.now() - startTime < CAPTURE_MAX_FONT_WAIT_MS) {
      const allReady = CAPTURE_FONT_WEIGHTS.every((weight) =>
        document.fonts.check(`${weight} 1em ${CAPTURE_FONT_FAMILY}`)
      );
      if (allReady) break;
      await sleep(50);
    }

    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  }, []);

  const waitForImages = useCallback(async (element: HTMLElement) => {
    const images = Array.from(element.querySelectorAll("img"));
    if (images.length === 0) return;

    const decodePromises = images
      .map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          return null;
        }

        if (typeof img.decode === "function") {
          return img.decode().catch(() => undefined);
        }

        return new Promise<void>((resolve) => {
          const handleDone = () => resolve();
          img.addEventListener("load", handleDone, { once: true });
          img.addEventListener("error", handleDone, { once: true });
        });
      })
      .filter(Boolean) as Promise<void>[];

    if (decodePromises.length > 0) {
      await Promise.all(decodePromises);
    }
  }, []);

  const getFontEmbedCSSForCapture = useCallback(
    async (element: HTMLElement) => {
      const cacheKey = "all-no-local";
      const cached = fontEmbedCSSCache.current.get(cacheKey);
      if (cached !== undefined) return cached;

      try {
        const css = await htmlToImage.getFontEmbedCSS(element);
        const normalized = stripLocalFontSources(css);
        fontEmbedCSSCache.current.set(cacheKey, normalized);
        return normalized;
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
      const rootElement = elementRef.current;
      const captureContainer =
        rootElement.querySelector<HTMLElement>(".recap-container");
      const captureTarget = captureContainer ?? rootElement;
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
      const originalCaptureStyles = {
        width: captureTarget.style.width,
        maxWidth: captureTarget.style.maxWidth,
        minWidth: captureTarget.style.minWidth,
        boxSizing: captureTarget.style.boxSizing,
      };
      const captureRootAttr = "data-capture-root";
      const hadCaptureRootAttr = captureTarget.hasAttribute(captureRootAttr);
      const originalLang = rootElement.getAttribute("lang");
      let externalImages: ExternalImageConversionResult | null = null;
      let videoReplacements: VideoReplacement[] = [];
      const isFirefox =
        typeof navigator !== "undefined" &&
        /firefox/i.test(navigator.userAgent);

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
        if (!hadCaptureRootAttr) {
          captureTarget.setAttribute(captureRootAttr, "true");
        }
        rootElement.setAttribute(
          "lang",
          document.documentElement.lang || "ko"
        );
        rootElement.classList.add("capture-mode");
        await new Promise((resolve) =>
          requestAnimationFrame(() => resolve(null))
        );
        await new Promise((resolve) =>
          requestAnimationFrame(() => resolve(null))
        );

        if (captureContainer) {
          const targetWidth =
            CAPTURE_DESKTOP_MIN_WIDTH + CAPTURE_SIDE_PADDING * 2;
          captureTarget.style.boxSizing = "border-box";
          captureTarget.style.maxWidth = "none";
          captureTarget.style.minWidth = "0";
          captureTarget.style.width = `${Math.ceil(targetWidth)}px`;
        }

        // 페이지 스크롤을 맨 위로 이동
        window.scrollTo(0, 0);

        // video 요소를 이미지로 대체 (Safari 모바일 대응) - 먼저 실행
        try {
          videoReplacements = replaceVideosWithImages(captureTarget);
        } catch (videoError) {
          console.warn("비디오 대체 실패, 계속 진행:", videoError);
        }

        // 외부 이미지를 Blob/Object URL로 변환 (병렬 처리됨)
        try {
          externalImages = await convertExternalImages(captureTarget);
        } catch (imgError) {
          console.warn("외부 이미지 변환 실패, 계속 진행:", imgError);
        }

        // 렌더링 완료 대기
        await waitForImages(captureTarget);
        await waitForFonts();
        const fontEmbedCSS = await getFontEmbedCSSForCapture(captureTarget);
        await new Promise((resolve) => setTimeout(resolve, 100));
        const shouldBustCache = !(externalImages?.objectUrls.length);

        let dataUrl = "";
        let downloadUrl = "";
        let revokeDownloadUrl: (() => void) | null = null;

        const renderWithHtml2Canvas = async () => {
          const canvas = await html2canvas(captureTarget, {
            scale: options.pixelRatio ?? 3,
            backgroundColor: options.backgroundColor ?? "#f2f4f6",
            useCORS: true,
            allowTaint: false,
            logging: false,
            foreignObjectRendering: isFirefox,
            onclone: (clonedDocument) => {
              if (!fontEmbedCSS) return;
              const style = clonedDocument.createElement("style");
              style.setAttribute("data-capture-fonts", "true");
              style.textContent = fontEmbedCSS;
              const clonedTarget =
                clonedDocument.querySelector(`[${captureRootAttr}="true"]`);
              if (clonedTarget) {
                clonedTarget.insertBefore(style, clonedTarget.firstChild);
              } else {
                clonedDocument.head.appendChild(style);
              }
            },
            scrollX: 0,
            scrollY: 0,
            windowWidth: captureTarget.scrollWidth,
            windowHeight: captureTarget.scrollHeight,
            ignoreElements: (node) => node instanceof HTMLVideoElement,
          });
          const fallbackBlob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, "image/png");
          });
          if (fallbackBlob) {
            downloadUrl = URL.createObjectURL(fallbackBlob);
            revokeDownloadUrl = () => URL.revokeObjectURL(downloadUrl);
          } else {
            dataUrl = canvas.toDataURL("image/png", 1.0);
          }
        };

        if (isFirefox) {
          await renderWithHtml2Canvas();
        } else {
          try {
            // html-to-image를 사용하여 캡처 (크로스 플랫폼 호환성 우수)
            const captureOptions = {
              quality: 1.0,
              pixelRatio: options.pixelRatio ?? 3,
              backgroundColor: options.backgroundColor ?? "#f2f4f6",
              fontEmbedCSS: fontEmbedCSS || undefined,
              // blob URL은 cache busting 쿼리 추가 시 실패할 수 있음
              cacheBust: shouldBustCache,
              imagePlaceholder: IMAGE_PLACEHOLDER,
              filter: (node: HTMLElement) => {
                return !(node instanceof HTMLVideoElement);
              },
            };

            if (typeof htmlToImage.toBlob === "function") {
              const blob = await htmlToImage.toBlob(
                captureTarget,
                captureOptions
              );
              if (blob) {
                downloadUrl = URL.createObjectURL(blob);
                revokeDownloadUrl = () => URL.revokeObjectURL(downloadUrl);
              } else {
                dataUrl = await htmlToImage.toPng(
                  captureTarget,
                  captureOptions
                );
              }
            } else {
              dataUrl = await htmlToImage.toPng(captureTarget, captureOptions);
            }
          } catch (htmlError) {
            console.warn(
              "html-to-image 실패, html2canvas로 재시도:",
              htmlError
            );
            await renderWithHtml2Canvas();
          }
        }

        // 다운로드 링크 생성
        const link = document.createElement("a");
        link.href = downloadUrl || dataUrl;
        link.download = options.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (revokeDownloadUrl) {
          setTimeout(() => revokeDownloadUrl?.(), 0);
        }
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
        if (externalImages) {
          restoreOriginalImages(externalImages.originalSrcs);
          revokeObjectUrls(externalImages.objectUrls);
        }
        // video 요소 복원
        if (videoReplacements.length > 0) {
          restoreVideos(videoReplacements);
        }
        rootElement.classList.remove("capture-mode");
        if (originalLang === null) {
          rootElement.removeAttribute("lang");
        } else {
          rootElement.setAttribute("lang", originalLang);
        }
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
        if (!hadCaptureRootAttr) {
          captureTarget.removeAttribute(captureRootAttr);
        }
        captureTarget.style.width = originalCaptureStyles.width;
        captureTarget.style.maxWidth = originalCaptureStyles.maxWidth;
        captureTarget.style.minWidth = originalCaptureStyles.minWidth;
        captureTarget.style.boxSizing = originalCaptureStyles.boxSizing;
        setIsSaving(false);
      }
    },
    [isSaving, convertExternalImages, waitForImages, waitForFonts, getFontEmbedCSSForCapture]
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
