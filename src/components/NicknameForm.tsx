"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type NicknameFormProps = {
  defaultNickname: string;
  onSubmit: (nickname: string) => void;
  buttonLabel?: string;
  helperText?: string;
};

export default function NicknameForm({
  defaultNickname,
  onSubmit,
  buttonLabel = "조회하기",
  helperText
}: NicknameFormProps) {
  const [value, setValue] = useState(defaultNickname);

  useEffect(() => {
    setValue(defaultNickname);
  }, [defaultNickname]);

  return (
    <form
      className="w-full flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (trimmed.length === 0) return;
        onSubmit(trimmed);
      }}
    >
      <div className="relative group">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-grey-400 group-focus-within:text-brand transition-colors">
          <Search size={20} />
        </div>
        <input
          className="w-full rounded-2xl border border-grey-200 bg-white px-6 py-3.5 pl-12 text-lg font-bold text-grey-900 transition-all placeholder:text-grey-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="닉네임 입력"

        />
      </div>

      <button
        type="submit"
        disabled={value.trim().length === 0}
        className="ui-btn w-full mt-2 py-3.5 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {buttonLabel}
      </button>

      {helperText && (
        <p className="text-xs text-grey-500 mt-2 text-center">
          {helperText}
        </p>
      )}
    </form>
  );
}
