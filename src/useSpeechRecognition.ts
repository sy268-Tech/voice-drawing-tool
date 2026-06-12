/* ── Web Speech API 语音识别 Hook（支持中英文切换、连续聆听） ── */

import { useCallback, useEffect, useRef, useState } from "react";
import { Lang } from "./types";

type SpeechState = {
  listening: boolean;
  supported: boolean;
  error: string;
  /** 实时中间识别结果（边说边显示） */
  interim: string;
};

type UseSpeechReturn = SpeechState & {
  startListening: () => void;
  stopListening: () => void;
};

export function useSpeechRecognition(
  onResult: (text: string) => void,
  lang: Lang,
  continuous: boolean
): UseSpeechReturn {
  const [state, setState] = useState<SpeechState>({
    listening: false,
    supported:
      "webkitSpeechRecognition" in window || "SpeechRecognition" in window,
    error: "",
    interim: "",
  });

  const recognitionRef = useRef<any>(null);
  // 用 ref 保存最新回调与配置，避免重建识别实例
  const onResultRef = useRef(onResult);
  const continuousRef = useRef(continuous);
  const stoppedByUserRef = useRef(false);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  const startListening = useCallback(() => {
    if (!state.supported) {
      setState((s) => ({
        ...s,
        error: lang === "zh-CN" ? "浏览器不支持语音识别，请使用 Chrome" : "Speech recognition is not supported. Please use Chrome.",
      }));
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    stoppedByUserRef.current = false;

    recognition.onstart = () => {
      setState((s) => ({ ...s, listening: true, error: "", interim: "" }));
    };

    recognition.onend = () => {
      setState((s) => ({ ...s, listening: false, interim: "" }));
      // 连续模式：自动续听（除非用户手动停止）
      if (continuousRef.current && !stoppedByUserRef.current) {
        try { recognition.start(); } catch { /* 忽略重复启动 */ }
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error ?? "";
      const zh = lang === "zh-CN";
      let msg = zh ? "语音识别出错" : "Speech recognition error";
      if (err === "network") msg = zh ? "语音服务不可用（需要网络）" : "Speech service unavailable (network required)";
      else if (err === "not-allowed") msg = zh ? "麦克风权限未授予" : "Microphone permission denied";
      else if (err === "no-speech") msg = zh ? "未检测到语音，请再说一次" : "No speech detected, please try again";
      if (err !== "no-speech") stoppedByUserRef.current = true;
      setState((s) => ({ ...s, listening: false, error: msg, interim: "" }));
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript as string;
        if (event.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      if (interimText) setState((s) => ({ ...s, interim: interimText }));
      if (finalText) {
        setState((s) => ({ ...s, interim: "" }));
        onResultRef.current(finalText.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [state.supported, lang]);

  const stopListening = useCallback(() => {
    stoppedByUserRef.current = true;
    recognitionRef.current?.stop();
    setState((s) => ({ ...s, listening: false, interim: "" }));
  }, []);

  return { ...state, startListening, stopListening };
}
