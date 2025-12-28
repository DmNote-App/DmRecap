"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import NicknameForm from "@/components/NicknameForm";
import { useNicknameStore } from "@/store/useNicknameStore";
import { checkNicknameExists } from "@/lib/varchive";

export default function HomePage() {
  const router = useRouter();
  const { nickname, setNickname } = useNicknameStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (value: string) => {
    setErrorMessage(null);
    setIsChecking(true);

    try {
      const exists = await checkNicknameExists(value);
      if (exists) {
        setNickname(value);
        router.push(`recap?nickname=${encodeURIComponent(value)}`);
        // 성공 시에는 isChecking을 true로 유지 (페이지 이동됨)
      } else {
        setErrorMessage("닉네임을 다시 확인해주세요.");
        setIsChecking(false); // 에러일 때만 버튼 되돌리기
      }
    } catch {
      // API 에러가 발생해도 일단 이동 (recap 페이지에서 다시 시도)
      setNickname(value);
      router.push(`recap?nickname=${encodeURIComponent(value)}`);
      // 이동하므로 isChecking 유지
    }
  };

  return (
    <main className="relative flex h-screen h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6">
      {/* Background Blobs (Glass Effect) */}
      <div className="absolute inset-0 pointer-events-none -z-10 bg-[#f2f4f6]">
        <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] bg-blue-200/40 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[40vw] h-[40vw] bg-indigo-200/40 rounded-full blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-lg flex flex-col gap-10">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="chip-blue mb-1">2025 RECAP</div>
          <h1 className="text-4xl font-bold leading-tight text-grey-900 md:text-5xl word-keep">
            <span className="text-brand">V-ARCHIVE</span> RECAP
          </h1>
          <p className="text-grey-600 leading-relaxed word-keep">
            2025년을 한눈에 확인해보세요!
          </p>
        </div>

        {/* Input Form (Simplified) */}
        <div className="w-full">
          <NicknameForm
            defaultNickname={nickname}
            onSubmit={handleSubmit}
            buttonLabel={isChecking ? "확인 중..." : "리캡 시작하기"}
            helperText="V-ARCHIVE에 등록된 닉네임으로 조회됩니다."
            errorMessage={errorMessage ?? undefined}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 left-0 right-0 text-center text-sm text-grey-500">
        <p>
          Developed by <span className="font-medium text-grey-700">DmNote</span>{" "}
          · API provided by{" "}
          <span className="font-medium text-grey-700">V-Archive</span>
        </p>
      </footer>
    </main>
  );
}

