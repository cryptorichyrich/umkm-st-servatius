import { useState, useRef, type ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { ImagePlus, X, Loader2 } from 'lucide-react';

interface Props {
  /** Storage bucket name */
  bucket: string;
  /** Folder path prefix (usually userId) */
  folder: string;
  /** Current list of image URLs */
  images: string[];
  /** Callback when images change */
  onChange: (images: string[]) => void;
  /** Max images allowed */
  max?: number;
  /** Label for the section */
  label?: string;
  /** Whether upload is required */
  required?: boolean;
}

export default function PhotoGalleryUploader({
  bucket,
  folder,
  images,
  onChange,
  max = 6,
  label = 'Galeri Foto',
  required = false,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > max) {
      setError(`Maksimal ${max} foto.`);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    if (!session) {
      setError('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setUploading(true);
    setError('');
    const uploaded: string[] = [];

    for (const file of files) {
      // 5MB limit
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} melebihi 5MB.`);
        continue;
      }
      try {
        const { uploadToR2 } = await import('../../lib/r2-upload');
        const { url } = await uploadToR2(file);
        uploaded.push(url);
      } catch (err) {
        setError(`Gagal upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    if (uploaded.length) {
      onChange([...images, ...uploaded]);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {required && <span className="ml-2 text-xs font-normal text-gray-400">Wajib minimal 1 foto</span>}
        {!required && <span className="ml-2 text-xs font-normal text-gray-400">Maksimal {max} foto (opsional)</span>}
      </label>

      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200">
            <img src={img} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100"
            >
              <X className="h-6 w-6 text-white" />
            </button>
            {i === 0 && (
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-[10px] font-bold text-white">
                Utama
              </span>
            )}
          </div>
        ))}

        {images.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition hover:border-paroki-300 hover:text-paroki-500 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-6 w-6" />
                <span className="text-[11px] font-medium">Tambah</span>
              </>
            )}
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />

      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
