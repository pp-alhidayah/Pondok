import React, { useEffect, useState } from 'react';
import { X, Undo2 } from 'lucide-react';

interface UndoMessage {
  id: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

const UNDO_EVENT = 'al_hidayah_undo_event';

export function showUndoToast(message: string, actionLabel: string, onAction: () => void) {
  const event = new CustomEvent<UndoMessage>(UNDO_EVENT, {
    detail: {
      id: Date.now().toString() + Math.random().toString(),
      message,
      actionLabel,
      onAction,
    },
  });
  window.dispatchEvent(event);
}

export const UndoToastContainer: React.FC = () => {
  const [items, setItems] = useState<UndoMessage[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<UndoMessage>;
      const item = customEvent.detail;
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }, 6000);
    };
    window.addEventListener(UNDO_EVENT, handler);
    return () => window.removeEventListener(UNDO_EVENT, handler);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-[9998] flex flex-col gap-2 max-w-sm w-full px-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium bg-slate-900 text-white"
        >
          <span>{item.message}</span>
          <button
            type="button"
            onClick={() => {
              item.onAction();
              setItems((prev) => prev.filter((i) => i.id !== item.id));
            }}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs"
          >
            <Undo2 className="w-3 h-3" />
            {item.actionLabel}
          </button>
          <button
            type="button"
            onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
            aria-label="Tutup"
            className="p-1 hover:opacity-70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default UndoToastContainer;
