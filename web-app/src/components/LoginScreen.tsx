import { useId, useRef, useState } from 'react';
import { AlertCircle, ArrowUp, Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';

interface LoginScreenProps {
  area: string;
  onLogin: (password: string) => Promise<void>;
  busy: boolean;
}

export default function LoginScreen({ area, onLogin, busy }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setError('');
    try {
      await onLogin(password);
    } catch (cause: any) {
      setError(cause?.message || "Couldn't sign in. Please verify password.");
      setPassword('');
      inputRef.current?.focus();
    }
  }

  function checkCapsLock(event: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState?.('CapsLock') ?? false);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-[#30363D] bg-[#161B22] p-7 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-[#21262D] border border-[#30363D] text-[#58A6FF] shadow-inner">
            <Lock className="size-5" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white">
            Sign in to access {area}
          </h2>
          <p className="mt-1 text-xs text-[#8B949E]">
            This workspace area requires authenticated administrative access.
          </p>
        </div>

        <form className="space-y-4" onSubmit={submit} noValidate>
          <input
            type="text"
            name="username"
            value="admin"
            autoComplete="username"
            readOnly
            hidden
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={fieldId} className="text-xs font-medium text-[#C9D1D9]">
                Admin Password
              </label>
              <button
                type="button"
                onClick={() => setPassword('admin123')}
                className="text-[11px] text-[#58A6FF] hover:text-[#79c0ff] transition-colors cursor-pointer font-medium"
              >
                Fill demo key
              </button>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                id={fieldId}
                name="password"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                placeholder="Enter password..."
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={checkCapsLock}
                onKeyUp={checkCapsLock}
                onBlur={() => setCapsLock(false)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                disabled={busy}
                className={`h-10 w-full rounded-md border bg-[#0D1117] pl-3.5 pr-10 text-xs text-white outline-none transition placeholder:text-[#6E7681] disabled:opacity-60 focus:ring-1 ${
                  error
                    ? 'border-[#DA3633] focus:ring-[#DA3633]/40'
                    : 'border-[#30363D] focus:border-[#58A6FF] focus:ring-[#58A6FF]/40'
                }`}
              />

              <button
                type="button"
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible(!visible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#8B949E] hover:text-white transition-colors cursor-pointer"
              >
                {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            <div className="min-h-5 text-xs" aria-live="polite">
              {error ? (
                <p id={errorId} role="alert" className="flex items-center gap-1.5 text-[#FF7B72]">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{error}</span>
                </p>
              ) : capsLock ? (
                <p className="flex items-center gap-1.5 text-[#FFA657]">
                  <ArrowUp className="size-3.5 shrink-0" />
                  <span>Caps Lock is on</span>
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !password}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white font-semibold text-xs shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            <span>{busy ? 'Authenticating...' : 'Sign in as Admin'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
