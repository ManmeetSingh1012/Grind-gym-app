"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { DietChatInput, DietChatReply } from "./schemas";

export function useDietChat() {
  return useMutation({ mutationFn: (input: DietChatInput) => api.post<DietChatReply>("/nutrition/chat", input) });
}
