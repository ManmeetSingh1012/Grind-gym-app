"use client";

import { Mic, Search, Square } from "lucide-react";
import type { FormEvent } from "react";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";

/**
 * Text box with a mic button. Typing updates `value`; speaking fills it and
 * calls `onSubmit` with the transcript so voice is hands-free.
 */
export function VoiceInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const speech = useSpeechRecognition({
    onFinal: (text) => {
      onChange(text);
      onSubmit(text);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={submit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={speech.listening ? speech.interim : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={speech.listening ? "Listening…" : placeholder}
            autoFocus={autoFocus}
            enterKeyHint="search"
            className="h-12 w-full rounded-xl border border-border bg-surface-2 pr-3 pl-9 text-base outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
        </div>
        {speech.supported ? (
          <button
            type="button"
            onClick={speech.listening ? speech.stop : speech.start}
            aria-label={speech.listening ? "Stop listening" : "Speak"}
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition",
              speech.listening ? "animate-pulse-ring bg-danger text-white" : "bg-accent text-accent-foreground",
            )}
          >
            {speech.listening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
          </button>
        ) : null}
      </form>
      {speech.error ? <p className="text-xs text-danger">{speech.error}</p> : null}
    </div>
  );
}
