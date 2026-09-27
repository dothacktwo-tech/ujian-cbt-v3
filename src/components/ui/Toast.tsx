import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;
let listeners: ToastListener[] = [];
let toastsState: ToastItem[] = [];

export const toast = {
  success(message: string, duration = 3500) {
    addToast({ id: Math.random().toString(), type: 'success', message, duration });
  },
  error(message: string, duration = 4500) {
    addToast({ id: Math.random().toString(), type: 'error', message, duration });
  },
  info(message: string, duration = 3500) {
    addToast({ id: Math.random().toString(), type: 'info', message, duration });
  },
};

function addToast(item: ToastItem) {
  toastsState = [...toastsState, item];
  listeners.forEach((l) => l(toastsState));

  if (item.duration) {
    setTimeout(() => {
      removeToast(item.id);
    }, item.duration);
  }
}

function removeToast(id: string) {
  toastsState = toastsState.filter((t) => t.id !== id);
  listeners.forEach((l) => l(toastsState));
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2 sm:p-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-lg border backdrop-blur-xs transition-all animate-in slide-in-from-bottom-2 ${
            t.type === 'success'
              ? 'bg-emerald-900/90 text-white border-emerald-700'
              : t.type === 'error'
              ? 'bg-rose-900/90 text-white border-rose-700'
              : 'bg-slate-900/90 text-white border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-sky-400 shrink-0" />}
            <p className="text-xs sm:text-sm font-medium leading-snug break-words">{t.message}</p>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="text-white/60 hover:text-white p-1 rounded-md transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
