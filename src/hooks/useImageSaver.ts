"use client";

import { useState, useRef, useCallback, RefObject } from "react";
import * as htmlToImage from "html-to-image";

// 프록시 환경에서도 올바른 API URL을 사용하도록 assetPrefix 설정
const API_BASE_URL =
  process.env.NODE_ENV === "production" ? "https://dm-recap.vercel.app" : "";

// 비디오 대체 정보 타입
type VideoReplacement = {
  video: HTMLVideoElement;
  img: HTMLImageElement | null;
  parent: HTMLElement;
};

// 이미지 저장 옵션 타입
type SaveImageOptions = {
  fileName: string;
  backgroundColor?: string;
  pixelRatio?: number;
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
const restoreOriginalImages = (originalSrcs: Map<HTMLImageElement, string>) => {
  originalSrcs.forEach((src, img) => {
    img.src = src;
  });
};

// 이미지 placeholder (로드 실패 시 사용)
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNFNUU4RUIiLz48L3N2Zz4=";

/**
 * 이미지 저장 기능을 제공하는 커스텀 훅
 */
export function useImageSaver() {
  const [isSaving, setIsSaving] = useState(false);
  // 이미지 base64 캐시 (중복 요청 방지)
  const imageCache = useRef<Map<string, string>>(new Map());

  // 이미지를 프록시를 통해 base64로 변환하는 함수
  const convertExternalImages = useCallback(
    async (element: HTMLElement): Promise<Map<HTMLImageElement, string>> => {
      const originalSrcs = new Map<HTMLImageElement, string>();
      const images = element.querySelectorAll("img");

      const promises = Array.from(images).map(async (img) => {
        if (
          !img.src ||
          img.src.startsWith("data:") ||
          img.src.startsWith(window.location.origin)
        ) {
          return;
        }

        // 원본 src 저장
        const originalSrc = img.src;
        originalSrcs.set(img, originalSrc);

        // 캐시에 있으면 재사용 (중복 API 요청 방지)
        const cached = imageCache.current.get(originalSrc);
        if (cached) {
          img.src = cached;
          return;
        }

        try {
          // 프록시를 통해 이미지 가져오기 (프록시 환경에서도 올바른 URL 사용)
          const proxyUrl = `${API_BASE_URL}/api/image-proxy?url=${encodeURIComponent(
            originalSrc
          )}`;
          const response = await fetch(proxyUrl);

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
          imageCache.current.set(originalSrc, dataUrl);
          img.src = dataUrl;
        } catch (e) {
          console.warn("이미지 변환 실패:", originalSrc);
          // 실패시 회색 placeholder로 대체
          imageCache.current.set(originalSrc, IMAGE_PLACEHOLDER);
          img.src = IMAGE_PLACEHOLDER;
        }
      });

      await Promise.all(promises);
      return originalSrcs;
    },
    []
  );

  // 요소를 이미지로 저장하는 함수
  const saveAsImage = useCallback(
    async (elementRef: RefObject<HTMLElement>, options: SaveImageOptions) => {
      if (!elementRef.current || isSaving) return;

      setIsSaving(true);
      let originalSrcs: Map<HTMLImageElement, string> | null = null;
      let videoReplacements: VideoReplacement[] = [];

      try {
        // 페이지 스크롤을 맨 위로 이동
        window.scrollTo(0, 0);

        // video 요소를 이미지로 대체 (Safari 모바일 대응) - 먼저 실행
        try {
          videoReplacements = replaceVideosWithImages(elementRef.current);
        } catch (videoError) {
          console.warn("비디오 대체 실패, 계속 진행:", videoError);
        }

        // 외부 이미지를 base64로 변환 (병렬 처리됨)
        try {
          originalSrcs = await convertExternalImages(elementRef.current);
        } catch (imgError) {
          console.warn("외부 이미지 변환 실패, 계속 진행:", imgError);
        }

        // 렌더링 완료 대기 (최소화)
        await new Promise((resolve) => setTimeout(resolve, 100));

        // html-to-image를 사용하여 PNG로 변환
        const dataUrl = await htmlToImage.toPng(elementRef.current, {
          quality: 1.0,
          pixelRatio: options.pixelRatio ?? 3,
          backgroundColor: options.backgroundColor ?? "#f2f4f6",
          skipFonts: true,
          cacheBust: true,
          imagePlaceholder: IMAGE_PLACEHOLDER,
          filter: (node) => {
            // hidden video 태그 제외
            if (node instanceof HTMLVideoElement) {
              return false;
            }
            return true;
          },
        });

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
        setIsSaving(false);
      }
    },
    [isSaving, convertExternalImages]
  );

  // 캐시 초기화 함수
  const clearCache = useCallback(() => {
    imageCache.current.clear();
  }, []);

  return {
    isSaving,
    saveAsImage,
    clearCache,
  };
}
