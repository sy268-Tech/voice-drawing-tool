/* ── Web Speech API 语音识别 Hook ── */

import { useCallback, useRef, useState } from "react";

type SpeechState = {
  listening: boolean;
  supported: boolean;
  error: string;
};

type UseSpeechReturn = SpeechState & {
  startListening: () => void;
  stopListening: () => void;
};

export function useSpeechRecognition(
  onResult: (text: string) => void
): UseSpeechReturn {
  const [state, setState] = useState<SpeechState>({
    listening: false,
    supported:
      "webkitSpeechRecognition" in window || "SpeechRecognition" in window,
    error: "",
  });

  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (!state.supported) {
      setState((s) => ({ ...s, error: "浏览器不支持语音识别，请使用 Chrome" }));
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setState((s) => ({ ...s, listening: true, error: "" }));
    };

    recognition.onend = () => {
      setState((s) => ({ ...s, listening: false }));
    };

    recognition.onerror = (event: any) => {
      const err = event.error ?? "";
      let msg = "语音识别出错";
      if (err === "network") msg = "语音服务不可用（需要网络）";
      else if (err === "not-allowed") msg = "麦克风权限未授予";
      else if (err === "no-speech") msg = "未检测到语音，请再说一次";
      setState((s) => ({ ...s, listening: false, error: msg }));
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript as string;
      onResult(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [state.supported, onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setState((s) => ({ ...s, listening: false }));
  }, []);

  return { ...state, startListening, stopListening };
}
