import { useState } from 'react';
import {
  Code2,
  Pencil,
  Trash2,
  Copy,
  Check,
  AlignLeft,
  Save,
  X,
  Search,
  Terminal,
} from 'lucide-react';
import { Snippet } from '../types';

interface SnippetsPanelProps {
  snippets: Snippet[];
  busy: boolean;
  onSave: (mode: 'dedent' | 'exact', draft: { id: string; shortcut: string; text: string }) => Promise<void>;
  onDelete: (snippet: Snippet) => void;
}

export default function SnippetsPanel({
  snippets,
  busy,
  onSave,
  onDelete,
}: SnippetsPanelProps) {
  const [draft, setDraft] = useState<{ id: string; shortcut: string; text: string }>({
    id: '',
    shortcut: '',
    text: '',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const filtered = snippets.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.shortcut.toLowerCase().includes(q) || s.text.toLowerCase().includes(q);
  });

  const handleCopy = (snippet: Snippet) => {
    navigator.clipboard.writeText(snippet.text);
    setCopiedId(snippet.id);
    setAnnouncement(`Snippet ${snippet.shortcut} copied to clipboard`);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleResetDraft = () => {
    setDraft({ id: '', shortcut: '', text: '' });
  };

  return (
    <div className="space-y-6">
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#30363D] pb-5">
        <div>
          <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-[#58A6FF]">
            DESKTOP AUTOMATION
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white mt-1">Snippet Library</h1>
          <p className="text-xs text-[#8B949E] mt-1 max-w-xl">
            Type any shortcut prefix on your desktop and ExamHelper expands it into full text or code.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161B22] border border-[#30363D] text-xs font-mono text-[#C9D1D9]">
            <Terminal className="size-3.5 text-[#58A6FF]" />
            <span>{snippets.length} Active Shortcuts</span>
          </div>
        </div>
      </div>

      {/* Grid: Editor Left + List Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Form Card */}
        <div className="lg:col-span-5 rounded-xl border border-[#30363D] bg-[#161B22] p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#21262D]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Code2 className="size-4 text-[#58A6FF]" />
              <span>{draft.id ? 'Edit Snippet' : 'Create New Snippet'}</span>
            </h2>
            {draft.id && (
              <button
                type="button"
                onClick={handleResetDraft}
                className="text-xs text-[#8B949E] hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <X className="size-3" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.shortcut.trim() || !draft.text.trim()) return;
              onSave('exact', draft);
              handleResetDraft();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-[#C9D1D9] mb-1.5">
                Trigger Shortcut
              </label>
              <input
                type="text"
                required
                maxLength={40}
                placeholder="/ty or ;date or !todo"
                value={draft.shortcut}
                onChange={(e) => setDraft({ ...draft, shortcut: e.target.value })}
                className="w-full h-9 px-3 font-mono text-xs bg-[#0D1117] border border-[#30363D] focus:border-[#58A6FF] rounded-md text-white placeholder:text-[#6E7681] focus:outline-none transition-colors"
              />
              <span className="text-[10px] text-[#8B949E] font-mono mt-1 block">
                Prefix with slash (/), semicolon (;), or exclamation (!) for clean triggers.
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#C9D1D9]">
                  Expansion Content
                </label>
                <span className="text-[10px] font-mono text-[#8B949E]">
                  {draft.text.length} chars
                </span>
              </div>
              <textarea
                required
                rows={7}
                maxLength={8000}
                placeholder="Enter full replacement text, code block, or message template..."
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                className="w-full p-3 font-mono text-xs bg-[#0D1117] border border-[#30363D] focus:border-[#58A6FF] rounded-md text-white placeholder:text-[#6E7681] focus:outline-none transition-colors resize-y leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#21262D]">
              <button
                type="button"
                disabled={busy || !draft.shortcut.trim() || !draft.text.trim()}
                onClick={() => {
                  onSave('dedent', draft);
                  handleResetDraft();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#30363D] bg-[#21262D] text-xs font-semibold text-[#C9D1D9] hover:text-white hover:border-[#8B949E] disabled:opacity-40 transition-colors cursor-pointer"
                title="Strips common leading indentation before saving"
              >
                <AlignLeft className="size-3.5" />
                <span>Dedent &amp; Save</span>
              </button>

              <button
                type="submit"
                disabled={busy || !draft.shortcut.trim() || !draft.text.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white font-bold text-xs shadow-sm disabled:opacity-40 transition-all cursor-pointer active:scale-95"
              >
                <Save className="size-3.5" />
                <span>{draft.id ? 'Update Snippet' : 'Save Snippet'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Snippets List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#8B949E]" />
            <input
              type="text"
              placeholder="Search shortcuts or template text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-[#010409] border border-[#30363D] focus:border-[#58A6FF] rounded-md text-[#C9D1D9] placeholder:text-[#6E7681] focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-2.5">
            {filtered.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-[#30363D] bg-[#161B22]/30 text-[#8B949E] text-xs">
                No snippets found matching “{search}”.
              </div>
            ) : (
              filtered.map((item) => {
                const isCopied = copiedId === item.id;
                const isSelectedForEdit = draft.id === item.id;

                return (
                  <article
                    key={item.id}
                    className={`group relative rounded-xl border p-4 transition-all duration-150 bg-[#161B22] ${
                      isSelectedForEdit
                        ? 'border-[#58A6FF] ring-1 ring-[#58A6FF]/40 bg-[#1F6FEB]/10'
                        : 'border-[#30363D] hover:border-[#8B949E]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-[#0D1117] border border-[#30363D] text-[#58A6FF]">
                          {item.shortcut}
                        </code>
                        <span className="text-[11px] text-[#8B949E] font-mono">
                          {item.text.length} chars
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {/* Inline copy swap */}
                        <button
                          type="button"
                          onClick={() => handleCopy(item)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                            isCopied
                              ? 'border-[#238636] bg-[#238636] text-white'
                              : 'border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-white'
                          }`}
                          title="Copy snippet text"
                        >
                          {isCopied ? (
                            <Check className="size-3 stroke-[2.5] text-white" />
                          ) : (
                            <Copy className="size-3 text-[#8B949E]" />
                          )}
                          <span className="text-[11px]">{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDraft({ id: item.id, shortcut: item.shortcut, text: item.text })}
                          className="p-1 text-[#8B949E] hover:text-[#58A6FF] rounded hover:bg-[#21262D] transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          className="p-1 text-[#8B949E] hover:text-[#FF7B72] rounded hover:bg-[#DA3633]/20 transition-colors cursor-pointer"
                          title="Delete snippet"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <pre className="mt-2.5 max-h-32 overflow-auto rounded-lg bg-[#0D1117] p-3 font-mono text-xs text-[#C9D1D9] whitespace-pre-wrap break-words leading-relaxed border border-[#21262D]">
                      {item.text}
                    </pre>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
