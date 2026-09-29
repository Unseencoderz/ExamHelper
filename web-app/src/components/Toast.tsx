import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const isSuccess = toast.variant === 'success';
          const isDanger = toast.variant === 'danger';
          const isWarning = toast.variant === 'warning';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border backdrop-blur-xl shadow-xl ${
                isDanger
                  ? 'bg-[#161B22] border-[#DA3633] text-[#FF7B72]'
                  : isSuccess
                  ? 'bg-[#161B22] border-[#238636] text-[#3FB950]'
                  : isWarning
                  ? 'bg-[#161B22] border-[#FFA657]/80 text-[#FFA657]'
                  : 'bg-[#161B22] border-[#30363D] text-[#C9D1D9]'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="size-4.5 text-[#3FB950]" />}
                {isDanger && <AlertCircle className="size-4.5 text-[#FF7B72]" />}
                {isWarning && <AlertTriangle className="size-4.5 text-[#FFA657]" />}
                {!isSuccess && !isDanger && !isWarning && <Info className="size-4.5 text-[#58A6FF]" />}
              </div>

              <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm font-semibold tracking-tight text-white">{toast.title}</p>
                {toast.description && (
                  <p className="text-xs mt-0.5 text-[#8B949E] leading-relaxed">{toast.description}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 p-1 rounded-md text-[#8B949E] hover:text-white hover:bg-[#21262D] transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
