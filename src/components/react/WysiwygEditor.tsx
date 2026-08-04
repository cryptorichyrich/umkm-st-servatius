import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface WysiwygEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

interface ToolbarButton {
  label: string;
  title: string;
  command: string;
  value?: string;
  className?: string;
}

const toolbarButtons: ToolbarButton[] = [
  { label: 'B', title: 'Bold', command: 'bold', className: 'font-bold' },
  { label: 'I', title: 'Italic', command: 'italic', className: 'italic' },
  { label: 'U', title: 'Underline', command: 'underline', className: 'underline' },
  { label: 'H2', title: 'Heading 2', command: 'formatBlock', value: 'h2' },
  { label: 'H3', title: 'Heading 3', command: 'formatBlock', value: 'h3' },
  { label: '¶', title: 'Paragraph', command: 'formatBlock', value: 'p' },
  { label: '• List', title: 'Bullet List', command: 'insertUnorderedList' },
  { label: '1. List', title: 'Numbered List', command: 'insertOrderedList' },
  { label: '❝ Quote', title: 'Blockquote', command: 'formatBlock', value: 'blockquote' },
];

export default function WysiwygEditor({ value, onChange, placeholder = '' }: WysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Set innerHTML from value ONLY on mount — not on every render (avoids cursor jump)
  useEffect(() => {
    if (editorRef.current && !hasInitialized.current) {
      editorRef.current.innerHTML = value;
      hasInitialized.current = true;
    }
  }, [value]);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    // Focus back into editor after toolbar action
    editorRef.current?.focus();
    // Notify parent of new content
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleLink = useCallback(() => {
    const url = window.prompt('Masukkan URL link:');
    if (url) {
      exec('createLink', url);
    }
  }, [exec]);

  const handleClearFormatting = useCallback(() => {
    exec('removeFormat');
    // Also clear block formatting back to paragraph
    exec('formatBlock', 'p');
  }, [exec]);

  // ── Image insert (upload to article-images bucket) ──
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset input

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `inline/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('article-images')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('article-images')
        .getPublicUrl(fileName);

      // Insert img at cursor position
      editorRef.current?.focus();
      document.execCommand('insertImage', false, publicUrl);

      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Gagal upload gambar: ' + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  // ── Internal link picker (search businesses) ──
  const [linkSearchOpen, setLinkSearchOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<Array<{ name: string; slug: string }>>([]);
  const linkSearchRef = useRef<HTMLInputElement>(null);

  const searchInternal = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setLinkResults([]);
      return;
    }
    const { data } = await supabase
      .from('businesses')
      .select('name, slug')
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .eq('status', 'approved')
      .limit(5);
    setLinkResults(data || []);
  }, []);

  const insertInternalLink = useCallback((name: string, slug: string) => {
    const url = `/umkm/${slug}/`;
    editorRef.current?.focus();
    document.execCommand('createLink', false, url);
    // After createLink, the selected text becomes the link. If no selection, insert the name.
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    setLinkSearchOpen(false);
    setLinkQuery('');
    setLinkResults([]);
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Use built-in bold/italic keyboard shortcuts via execCommand
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        exec('bold');
      } else if (key === 'i') {
        e.preventDefault();
        exec('italic');
      } else if (key === 'u') {
        e.preventDefault();
        exec('underline');
      }
    }
  };

  // Prevent default paste formatting — paste as plain text (optional improvement)
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const btnClass =
    'px-2.5 py-1 text-sm rounded-md border border-gray-200 bg-white text-gray-700 ' +
    'hover:bg-paroki-50 hover:border-paroki-300 hover:text-paroki-700 ' +
    'transition-colors cursor-pointer select-none leading-none';

  return (
    <div className="w-full rounded-lg border border-paroki-200 overflow-hidden focus-within:border-paroki-500 transition-colors">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 border-b border-paroki-200 px-3 py-2">
        {toolbarButtons.map((btn) => (
          <button
            key={btn.title}
            type="button"
            title={btn.title}
            className={`${btnClass} ${btn.className ?? ''}`}
            onMouseDown={(e) => {
              e.preventDefault(); // keep editor focus/selection
              exec(btn.command, btn.value);
            }}
          >
            {btn.label}
          </button>
        ))}

        <button
          type="button"
          title="Insert Horizontal Rule"
          className={`${btnClass} flex items-center gap-1`}
          onMouseDown={(e) => {
            e.preventDefault();
            exec('insertHorizontalRule');
          }}
        >
          ― Garis
        </button>

        <button
          type="button"
          title="Sisipkan Gambar"
          className={`${btnClass} flex items-center gap-1`}
          onMouseDown={(e) => {
            e.preventDefault();
            handleImageUpload();
          }}
          disabled={uploading}
        >
          {uploading ? '⏳...' : '🖼️ Gambar'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* External Link */}
        <button
          type="button"
          title="Insert Link"
          className={`${btnClass} flex items-center gap-1`}
          onMouseDown={(e) => {
            e.preventDefault();
            handleLink();
          }}
        >
          🔗 Link
        </button>

        {/* Internal Link Picker */}
        <div className="relative">
          <button
            type="button"
            title="Link Internal ke UMKM"
            className={`${btnClass} flex items-center gap-1`}
            onMouseDown={(e) => {
              e.preventDefault();
              setLinkSearchOpen(!linkSearchOpen);
            }}
          >
            🏪 Link UMKM
          </button>
          {linkSearchOpen && (
            <div className="absolute top-full mt-1 right-0 z-50 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
              <input
                ref={linkSearchRef}
                type="text"
                value={linkQuery}
                onChange={(e) => { setLinkQuery(e.target.value); searchInternal(e.target.value); }}
                placeholder="Cari nama UMKM..."
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-paroki-500 focus:outline-none"
                autoFocus
              />
              {linkResults.length > 0 && (
                <div className="mt-2 space-y-1">
                  {linkResults.map((biz) => (
                    <button
                      key={biz.slug}
                      type="button"
                      className="w-full rounded-md px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-paroki-50"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertInternalLink(biz.name, biz.slug);
                      }}
                    >
                      {biz.name}
                    </button>
                  ))}
                </div>
              )}
              {linkQuery.length >= 2 && linkResults.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">UMKM tidak ditemukan</p>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          title="Clear Formatting"
          className={`${btnClass} flex items-center gap-1`}
          onMouseDown={(e) => {
            e.preventDefault();
            handleClearFormatting();
          }}
        >
          ⌫ Clear
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="wysiwyg-content min-h-[200px] px-4 py-3 outline-none text-gray-800 text-sm leading-relaxed"
      />
    </div>
  );
}
