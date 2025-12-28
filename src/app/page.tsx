"use client";

import { useRouter } from "next/navigation";

import NicknameForm from "@/components/NicknameForm";
import { useNicknameStore } from "@/store/useNicknameStore";

export default function HomePage() {
  const router = useRouter();
  const { nickname, setNickname } = useNicknameStore();

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 py-20">
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
            onSubmit={(value) => {
              setNickname(value);
              router.push(`recap?nickname=${encodeURIComponent(value)}`);
            }}
            buttonLabel="리캡 시작하기"
            helperText="V-ARCHIVE에 등록된 닉네임으로 조회됩니다."
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
