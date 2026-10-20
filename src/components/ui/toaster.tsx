'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  push: (message: string, kind?: ToastKind) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = ++seq;
      setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
      const t = setTimeout(() => remove(id), kind === 'error' ? 7000 : 4500);
      timers.current.set(id, t);
    },
    [remove],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <button
            key={t.id}
            onClick={() => remove(t.id)}
            className={`pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl transition animate-fade-up text-left ${
              t.kind === 'success'
                ? 'border-success/40 bg-success/15 text-foreground'
                : t.kind === 'error'
                  ? 'border-danger/40 bg-danger/15 text-foreground'
                  : 'border-border bg-card/95 text-foreground'
            }`}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Provider ausente não deve derrubar a página: vira no-op silencioso.
    return { push: () => {}, success: () => {}, error: () => {}, info: () => {} };
  }
  return ctx;
}

export { ToastContext };
