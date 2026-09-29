import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface ConfirmDialogProps {
  confirmation: ConfirmationOptions | null;
  onClose: () => void;
}

export default function ConfirmDialog({ confirmation, onClose }: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => cancelBtnRef.current?.focus(), 50);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmation, onClose]);

  if (!confirmation) return null;
  const { title, message, confirmLabel = 'Confirm', danger = true, onConfirm } = confirmation;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#010409]/80 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 8 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
          className="relative w-full max-w-md overflow-hidden rounded-xl border border-[#30363D] bg-[#161B22] p-6 shadow-2xl z-10 text-[#C9D1D9]"
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${
                danger
                  ? 'border-[#DA3633]/40 bg-[#DA3633]/15 text-[#FF7B72]'
                  : 'border-[#30363D] bg-[#21262D] text-[#58A6FF]'
              }`}
            >
              {danger ? <Trash2 className="size-5" /> : <AlertTriangle className="size-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <h2 id="confirm-dialog-title" className="text-base font-semibold text-white">
                {title}
              </h2>
              <p id="confirm-dialog-description" className="mt-2 text-xs text-[#8B949E] leading-relaxed">
                {message}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-[#8B949E] hover:text-white p-1 rounded-md hover:bg-[#21262D] transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-[#21262D]">
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-[#C9D1D9] hover:text-white rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onConfirm();
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md shadow-sm transition-all cursor-pointer ${
                danger
                  ? 'bg-[#DA3633] text-white hover:bg-[#b62324] active:scale-95'
                  : 'bg-[#238636] text-white hover:bg-[#2ea043] active:scale-95'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
