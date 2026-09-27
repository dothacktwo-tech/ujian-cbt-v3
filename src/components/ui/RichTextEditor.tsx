import React, { useRef, useState, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Table as TableIcon,
  Code,
  Quote,
  RotateCcw,
  Eye,
  FileCode,
  Sparkles,
  Eraser,
  Upload,
  Link as LinkIcon,
  X,
  Check,
} from 'lucide-react';
import { RichContent } from './RichContent';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  label?: string;
  placeholder?: string;
  minHeight?: string;
  compact?: boolean;
  required?: boolean;
  error?: string;
  helperText?: string;
}

const MATH_SYMBOLS = [
  '×', '÷', '±', '≠', '≤', '≥', '≈', '√', 'π', '∞', '°',
  '²', '³', '½', '¼', '¾', 'α', 'β', 'γ', 'θ', 'λ', 'μ',
  'Δ', 'Σ', 'Ω', '→', '←', '↔', '⇒', '∫', '∂', '‰', '∈'
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  name,
  label,
  placeholder = 'Tuliskan teks di sini...',
  minHeight = '140px',
  compact = false,
  required = false,
  error,
  helperText,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'editor' | 'source' | 'preview'>('editor');
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [sourceCode, setSourceCode] = useState(value);

  const isEditorEmpty =
    !value ||
    value === '<br>' ||
    value === '<div><br></div>' ||
    value === '<p><br></p>' ||
    value.replace(/<[^>]*>/g, '').trim() === '';

  // Keep editor content in sync when value changes externally
  useEffect(() => {
    if (editorRef.current && activeTab === 'editor') {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    setSourceCode(value || '');
  }, [value, activeTab]);

  const execCmd = (command: string, arg: string | undefined = undefined) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, arg);
    triggerChange();
  };

  const triggerChange = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // If only empty br or whitespace, treat as empty
      const isActuallyEmpty = html === '<br>' || html === '<div><br></div>' || html.trim() === '';
      const cleanHtml = isActuallyEmpty ? '' : html;
      onChange(cleanHtml);
      setSourceCode(cleanHtml);
    }
  };

  const insertSymbol = (symbol: string) => {
    execCmd('insertText', symbol);
    setShowSymbolPicker(false);
  };

  const handleInsertTable = (rows = 3, cols = 3) => {
    let tableHtml = '<table class="border border-slate-300 w-full my-2 border-collapse text-left"><thead><tr>';
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<th class="border border-slate-300 bg-slate-100 p-2 font-bold text-xs">Kolom ${c}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    for (let r = 1; r <= rows - 1; r++) {
      tableHtml += '<tr>';
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<td class="border border-slate-300 p-2 text-xs">Data ${r}.${c}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br></p>';

    execCmd('insertHTML', tableHtml);
  };

  const handleInsertImageUrl = () => {
    if (!imageUrl.trim()) return;
    const imgHtml = `<p><img src="${imageUrl.trim()}" alt="Gambar Soal" class="max-w-full rounded-lg my-2 border border-slate-200" /></p><p><br></p>`;
    execCmd('insertHTML', imgHtml);
    setImageUrl('');
    setShowImageModal(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Hanya berkas gambar (PNG, JPG, JPEG, WEBP, GIF) yang didukung.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        const imgHtml = `<p><img src="${dataUrl}" alt="${file.name}" class="max-w-full rounded-lg my-2 border border-slate-200" /></p><p><br></p>`;
        execCmd('insertHTML', imgHtml);
        setShowImageModal(false);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setSourceCode(val);
    onChange(val);
  };

  return (
    <div className="space-y-1.5 w-full">
      {/* Label and Mode Switcher */}
      <div className="flex items-center justify-between">
        {label && (
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
        )}

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-auto">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors flex items-center gap-1 ${
              activeTab === 'editor'
                ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('source')}
            className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors flex items-center gap-1 ${
              activeTab === 'source'
                ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-3 h-3" />
            HTML
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors flex items-center gap-1 ${
              activeTab === 'preview'
                ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3 h-3" />
            Pratinjau
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div
        className={`rounded-xl border transition-all ${
          error
            ? 'border-rose-300 ring-2 ring-rose-100'
            : 'border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100'
        } bg-white overflow-hidden shadow-2xs`}
      >
        {/* Toolbar (Visible in Visual Editor Mode) */}
        {activeTab === 'editor' && (
          <div className="bg-slate-50 border-b border-slate-200 p-1.5 flex flex-wrap items-center gap-1 text-slate-700 select-none">
            {/* Text Styling */}
            <div className="flex items-center border-r border-slate-200 pr-1 mr-1 gap-0.5">
              <button
                type="button"
                onClick={() => execCmd('bold')}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                title="Tebal (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('italic')}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                title="Miring (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('underline')}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                title="Garis Bawah (Ctrl+U)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('strikeThrough')}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                title="Coret"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Subscript / Superscript (Essential for Math & Science) */}
            <div className="flex items-center border-r border-slate-200 pr-1 mr-1 gap-0.5">
              <button
                type="button"
                onClick={() => execCmd('subscript')}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors text-xs font-bold"
                title="Subscript (H₂O)"
              >
                <Subscript className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('superscript')}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors text-xs font-bold"
                title="Superscript (x²)"
              >
                <Superscript className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Lists */}
            <div className="flex items-center border-r border-slate-200 pr-1 mr-1 gap-0.5">
              <button
                type="button"
                onClick={() => execCmd('insertUnorderedList')}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                title="Daftar Poin"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('insertOrderedList')}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                title="Daftar Nomor"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Alignment */}
            {!compact && (
              <div className="flex items-center border-r border-slate-200 pr-1 mr-1 gap-0.5">
                <button
                  type="button"
                  onClick={() => execCmd('justifyLeft')}
                  className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                  title="Rata Kiri"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('justifyCenter')}
                  className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                  title="Rata Tengah"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('justifyRight')}
                  className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                  title="Rata Kanan"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Math & Science Symbols Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSymbolPicker(!showSymbolPicker)}
                className={`px-2 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1 ${
                  showSymbolPicker
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                }`}
                title="Simbol Matematika & Sains"
              >
                <Sparkles className="w-3 h-3" />
                Simbol π/±
              </button>

              {/* Symbol Picker Popover */}
              {showSymbolPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-50 w-64 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      Pilih Simbol Matematika
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSymbolPicker(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {MATH_SYMBOLS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => insertSymbol(s)}
                        className="w-7 h-7 text-xs font-bold font-mono rounded hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors border border-slate-100"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Media: Image & Table Insert */}
            <div className="flex items-center border-l border-slate-200 pl-1 ml-1 gap-0.5">
              <button
                type="button"
                onClick={() => setShowImageModal(true)}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-indigo-700 font-semibold transition-colors flex items-center gap-1 text-xs"
                title="Sisipkan Gambar (URL / Unggah)"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {!compact && <span className="text-[11px]">Gambar</span>}
              </button>

              <button
                type="button"
                onClick={() => handleInsertTable(3, 3)}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                title="Sisipkan Tabel (3x3)"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => execCmd('formatBlock', '<blockquote>')}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-slate-700 transition-colors"
                title="Kutipan (Quote)"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => execCmd('removeFormat')}
                className="p-1.5 rounded hover:bg-slate-200/80 active:bg-slate-300 text-rose-600 transition-colors ml-auto"
                title="Hapus Format Teks"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Visual Editable Div */}
        {activeTab === 'editor' && (
          <div className="relative">
            {isEditorEmpty && (
              <div
                onClick={() => editorRef.current?.focus()}
                className="absolute top-3 left-3 text-slate-400 pointer-events-none select-none text-sm leading-relaxed"
              >
                {placeholder}
              </div>
            )}
            <div
              ref={editorRef}
              contentEditable
              onInput={triggerChange}
              onBlur={triggerChange}
              className="p-3 text-sm text-slate-900 focus:outline-none overflow-y-auto leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2 [&_th]:text-xs [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_td]:text-xs [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2.5 [&_img]:shadow-xs [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-400 [&_blockquote]:pl-3 [&_blockquote]:italic [&_sub]:text-[0.75em] [&_sup]:text-[0.75em]"
              style={{ minHeight }}
            />
          </div>
        )}

        {name && <input type="hidden" name={name} value={value || ''} />}

        {/* Tab 2: HTML Raw Source Code */}
        {activeTab === 'source' && (
          <textarea
            value={sourceCode}
            onChange={handleSourceChange}
            placeholder="<div>Tulis kode HTML langsung di sini...</div>"
            className="w-full p-3 font-mono text-xs text-slate-900 bg-slate-900 text-emerald-300 focus:outline-none leading-relaxed resize-y"
            style={{ minHeight }}
          />
        )}

        {/* Tab 3: Live Preview */}
        {activeTab === 'preview' && (
          <div className="p-4 bg-slate-50/60 overflow-y-auto" style={{ minHeight }}>
            {value ? (
              <RichContent content={value} />
            ) : (
              <span className="text-slate-400 text-xs italic">Belum ada konten untuk ditampilkan.</span>
            )}
          </div>
        )}
      </div>

      {/* Helper text or error message */}
      {error ? (
        <p className="text-xs text-rose-500 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-400">{helperText}</p>
      ) : null}

      {/* Insert Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                Sisipkan Gambar ke Soal
              </h4>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option 1: URL input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Tautan Gambar (URL Web)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://example.com/gambar-soal.png"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleInsertImageUrl}
                  disabled={!imageUrl.trim()}
                  className="bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700"
                >
                  Sisipkan
                </button>
              </div>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-400">Atau Unggah Langsung</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Option 2: Local upload */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50 rounded-xl p-5 text-center cursor-pointer transition-all"
            >
              <Upload className="w-6 h-6 text-indigo-600 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-800">Klik untuk Unggah Berkas Gambar</p>
              <p className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, JPEG, WEBP, GIF (langsung tersimpan di soal)</p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
