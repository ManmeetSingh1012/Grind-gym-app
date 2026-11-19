"use client";

import { Check, Mic, Plus, SendHorizontal, Sparkles, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { toIsoDate } from "@/lib/dates";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import { cn, formatNumber } from "@/lib/utils";
import { useAddFoods } from "@/modules/nutrition/hooks";
import { useDietChat } from "../hooks";
import type { ChatMessage, DietChatReply } from "../schemas";

type Entry = ChatMessage & { id: string; foods?: DietChatReply["foods"]; meal?: DietChatReply["meal"]; logged?: boolean };

const STORAGE_KEY = "grind.dietChat.v1";
const VOICE_KEY = "grind.dietChat.voice";

const SUGGESTIONS = [
  "What should I eat for dinner to hit my protein?",
  "I just had 2 rotis, dal and a bowl of curd",
  "High-protein veg snacks under 200 kcal?",
  "How many calories do I have left today?",
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: chat still works for this session.
  }
}

const newId = () => Math.random().toString(36).slice(2);

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN";
  window.speechSynthesis.speak(u);
}

export function DietChat() {
  const [entries, setEntries] = useState<Entry[]>(() => load<Entry[]>(STORAGE_KEY, []));
  const [voiceReplies, setVoiceReplies] = useState<boolean>(() => load(VOICE_KEY, false));
  const [text, setText] = useState("");
  const chat = useDietChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => save(STORAGE_KEY, entries.slice(-40)), [entries]);
  useEffect(() => save(VOICE_KEY, voiceReplies), [voiceReplies]);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [entries.length, chat.isPending]);

  function send(raw: string) {
    const content = raw.trim();
    if (!content || chat.isPending) return;
    const userEntry: Entry = { id: newId(), role: "user", content };
    const next = [...entries, userEntry];
    setEntries(next);
    setText("");
    chat.mutate(
      { messages: next.slice(-20).map(({ role, content }) => ({ role, content })), date: toIsoDate() },
      {
        onSuccess: (res) => {
          setEntries((prev) => [
            ...prev,
            { id: newId(), role: "assistant", content: res.reply, foods: res.foods, meal: res.meal },
          ]);
          if (voiceReplies) speak(res.reply);
        },
      },
    );
  }

  const speech = useSpeechRecognition({ onFinal: send });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(text);
  }

  return (
    <>
      <PageHeader
        title="Diet coach"
        subtitle="Ask anything about food · type or speak"
        action={
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={voiceReplies ? "Turn off spoken replies" : "Read replies aloud"}
              onClick={() => {
                if (voiceReplies) window.speechSynthesis?.cancel();
                setVoiceReplies(!voiceReplies);
              }}
              className={voiceReplies ? "text-accent" : undefined}
            >
              {voiceReplies ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
            {entries.length ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear chat"
                onClick={() => {
                  if (confirm("Clear this chat?")) setEntries([]);
                }}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-3 pb-24">
        {!entries.length ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-gradient-to-b from-accent/10 to-surface px-5 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">Your diet, sorted.</p>
              <p className="mt-1 text-sm text-muted">
                I know your targets and what you&apos;ve eaten today. Tell me what you ate and I&apos;ll log it, or ask what to eat next.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-left text-sm transition hover:border-accent/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {entries.map((e) => (
          <Bubble
            key={e.id}
            entry={e}
            onLogged={() => setEntries((prev) => prev.map((p) => (p.id === e.id ? { ...p, logged: true } : p)))}
          />
        ))}

        {chat.isPending ? (
          <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md bg-surface px-4 py-3">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/90 backdrop-blur-lg"
      >
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-2.5">
          <input
            value={speech.listening ? speech.interim : text}
            onChange={(e) => setText(e.target.value)}
            placeholder={speech.listening ? "Listening…" : "Message your diet coach…"}
            enterKeyHint="send"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-surface-2 px-4 text-base outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
          {speech.supported ? (
            <button
              type="button"
              onClick={speech.listening ? speech.stop : speech.start}
              aria-label={speech.listening ? "Stop listening" : "Speak"}
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition",
                speech.listening ? "animate-pulse-ring bg-danger text-white" : "bg-surface-2 text-foreground hover:bg-border",
              )}
            >
              {speech.listening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
            </button>
          ) : null}
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim() || chat.isPending}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition active:scale-95 disabled:opacity-40"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </div>
        {speech.error ? <p className="mx-auto max-w-lg px-4 pb-2 text-xs text-danger">{speech.error}</p> : null}
      </form>
    </>
  );
}

function Bubble({ entry, onLogged }: { entry: Entry; onLogged: () => void }) {
  const add = useAddFoods();
  const mine = entry.role === "user";
  const foods = entry.foods ?? [];
  const kcal = foods.reduce((s, f) => s + f.calories, 0);

  return (
    <div className={cn("flex flex-col gap-2", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
          mine ? "rounded-br-md bg-accent text-accent-foreground" : "rounded-bl-md border border-border bg-surface",
        )}
      >
        {entry.content}
      </div>
      {foods.length ? (
        <div className="w-[85%] rounded-2xl border border-accent/30 bg-accent/5 p-3">
          <ul className="mb-2 flex flex-col gap-1 text-sm">
            {foods.map((f, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  {f.name} <span className="text-muted">· {formatNumber(f.quantity, 1)} {f.unit}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatNumber(f.calories)} kcal</span>
              </li>
            ))}
          </ul>
          {entry.logged ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-success">
              <Check className="h-4 w-4" /> Logged to {entry.meal ?? "today"}
            </p>
          ) : (
            <Button
              size="sm"
              className="w-full"
              loading={add.isPending}
              onClick={() =>
                add.mutate(
                  foods.map(({ grams_total: _, ...f }) => ({
                    ...f,
                    eaten_on: toIsoDate(),
                    meal: entry.meal ?? "snack",
                    source: "ai" as const,
                  })),
                  {
                    onSuccess: () => {
                      toast.success(`Logged ${formatNumber(kcal)} kcal`);
                      onLogged();
                    },
                  },
                )
              }
            >
              <Plus className="h-4 w-4" /> Log {foods.length} item{foods.length > 1 ? "s" : ""} · {formatNumber(kcal)} kcal
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
