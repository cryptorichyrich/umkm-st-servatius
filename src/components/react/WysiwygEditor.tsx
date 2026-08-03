import { useEffect, useRef, useCallback } from 'react';

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
          title="Insert Link"
          className={`${btnClass} flex items-center gap-1`}
          onMouseDown={(e) => {
            e.preventDefault();
            handleLink();
          }}
        >
          🔗 Link
        </button>

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
