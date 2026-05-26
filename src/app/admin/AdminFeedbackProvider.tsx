"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import ConfirmDialog from "@/app/shared/ConfirmDialog";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ConfirmInput = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
};

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ConfirmRequest = ConfirmInput & {
  resolve: (accepted: boolean) => void;
};

type AdminFeedbackContextValue = {
  showToast: (input: ToastInput | string) => void;
  confirmAction: (input: ConfirmInput) => Promise<boolean>;
};

const AdminFeedbackContext = createContext<AdminFeedbackContextValue | null>(null);

function normalizeToastInput(input: ToastInput | string): ToastInput {
  if (typeof input === "string") {
    return { message: input };
  }

  return input;
}

export function useAdminFeedback(): AdminFeedbackContextValue {
  const value = useContext(AdminFeedbackContext);
  if (!value) {
    throw new Error("useAdminFeedback must be used inside AdminFeedbackProvider");
  }

  return value;
}

export default function AdminFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);

  const showToast = useCallback((rawInput: ToastInput | string) => {
    const input = normalizeToastInput(rawInput);
    const id = Date.now() + Math.floor(Math.random() * 10_000);
    const tone = input.tone ?? "info";
    const durationMs = input.durationMs ?? 3200;

    setToasts((previous) => [...previous, { id, message: input.message, tone }]);

    window.setTimeout(() => {
      setToasts((previous) => previous.filter((item) => item.id !== id));
    }, durationMs);
  }, []);

  const confirmAction = useCallback((input: ConfirmInput) => {
    return new Promise<boolean>((resolve) => {
      setConfirmRequest((existing) => {
        if (existing) {
          resolve(false);
          return existing;
        }

        return { ...input, resolve };
      });
    });
  }, []);

  const contextValue = useMemo<AdminFeedbackContextValue>(() => {
    return {
      showToast,
      confirmAction,
    };
  }, [confirmAction, showToast]);

  return (
    <AdminFeedbackContext.Provider value={contextValue}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-55 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const toneClass =
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : toast.tone === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-line bg-surface text-foreground/85";

          return (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm ${toneClass}`}
            >
              {toast.message}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(confirmRequest)}
        title={confirmRequest?.title ?? "Confirm action"}
        description={confirmRequest?.description ?? "Please confirm before continuing."}
        confirmLabel={confirmRequest?.confirmLabel ?? "Confirm"}
        cancelLabel={confirmRequest?.cancelLabel}
        tone={confirmRequest?.tone}
        onConfirm={() => {
          confirmRequest?.resolve(true);
          setConfirmRequest(null);
        }}
        onCancel={() => {
          confirmRequest?.resolve(false);
          setConfirmRequest(null);
        }}
      />
    </AdminFeedbackContext.Provider>
  );
}
