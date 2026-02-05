'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface ImageUploadProps {
  videoId: string;
  currentImageUrl?: string | null;
  onImageChange?: (imageUrl: string | null) => void;
}

export function ImageUpload({ videoId, currentImageUrl, onImageChange }: ImageUploadProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(currentImageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Sync with prop changes
  useEffect(() => {
    setImageUrl(currentImageUrl || null);
  }, [currentImageUrl]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setIsUploading(true);

    // Create preview
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/admin/recipes/${videoId}/image`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setImageUrl(data.image_url);
      onImageChange?.(data.image_url);

      // Clear preview since we now have the real URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      // Clear preview on error
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  }, [videoId, onImageChange, previewUrl]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      uploadFile(file);
    } else {
      setError('Please drop an image file');
    }
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  // Handle paste from clipboard
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          uploadFile(file);
        }
        break;
      }
    }
  }, [uploadFile]);

  // Register paste listener
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    // Make the drop zone focusable for paste events
    dropZone.tabIndex = 0;

    const handleFocusPaste = (e: ClipboardEvent) => {
      if (document.activeElement === dropZone || dropZone.contains(document.activeElement)) {
        handlePaste(e);
      }
    };

    document.addEventListener('paste', handleFocusPaste);
    return () => {
      document.removeEventListener('paste', handleFocusPaste);
    };
  }, [handlePaste]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Are you sure you want to remove this image?')) return;

    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/recipes/${videoId}/image`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
      }

      setImageUrl(null);
      onImageChange?.(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsUploading(false);
    }
  }, [videoId, onImageChange]);

  const displayUrl = previewUrl || imageUrl;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Recipe Image
      </label>

      {displayUrl ? (
        <div className="relative group">
          <img
            src={displayUrl}
            alt="Recipe"
            className="w-full max-w-md rounded-lg border border-zinc-700 object-cover"
            style={{ maxHeight: '300px' }}
          />
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
            </div>
          )}
          {!isUploading && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-zinc-800/90 hover:bg-zinc-700 rounded-lg text-white text-sm"
                title="Replace image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={handleDelete}
                className="p-2 bg-red-600/90 hover:bg-red-500 rounded-lg text-white text-sm"
                title="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          ref={dropZoneRef}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
            ${isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-zinc-600 hover:border-zinc-500 hover:bg-zinc-800/50'
            }
            ${isUploading ? 'pointer-events-none opacity-50' : ''}
          `}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
              <span className="text-sm text-zinc-400">Uploading...</span>
            </div>
          ) : (
            <>
              <svg className="mx-auto h-12 w-12 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-2 text-sm text-zinc-400">
                <span className="font-medium text-blue-400">Click to upload</span>
                {' '}or drag and drop
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                You can also paste an image from clipboard (click here first)
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                PNG, JPG, WebP, GIF up to 5MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
