'use client';

import { useState, useEffect } from 'react';

interface IngredientImage {
  name: string;
  slug: string;
  url: string;
  created_at: string;
}

export default function IngredientsPage() {
  const [ingredient, setIngredient] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<IngredientImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);

  // Fetch existing images on mount
  useEffect(() => {
    async function fetchImages() {
      try {
        const res = await fetch('/api/admin/ingredients/generate-image');
        const data = await res.json();
        if (res.ok) {
          setImages(data.images || []);
        }
      } catch (err) {
        console.error('Failed to fetch images:', err);
      } finally {
        setLoadingImages(false);
      }
    }
    fetchImages();
  }, []);

  const handleGenerate = async () => {
    if (!ingredient.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const res = await fetch('/api/admin/ingredients/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient: ingredient.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate image');
        return;
      }

      setGeneratedImage({ url: data.image_url, name: ingredient.trim() });

      // Add to the list
      setImages(prev => [{
        name: ingredient.trim(),
        slug: data.slug,
        url: data.image_url,
        created_at: new Date().toISOString(),
      }, ...prev]);

      setIngredient('');
    } catch (err) {
      setError('Failed to generate image');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Ingredient Images</h1>

      {/* Generation form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-4">
          Generate Watercolor Illustration
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={ingredient}
            onChange={(e) => setIngredient(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="e.g. red bell pepper"
            disabled={isGenerating}
            className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={handleGenerate}
            disabled={!ingredient.trim() || isGenerating}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              'Generate'
            )}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}

        {/* Preview of just-generated image */}
        {generatedImage && (
          <div className="mt-6">
            <p className="text-sm text-zinc-400 mb-2">
              Generated: <span className="text-zinc-200">{generatedImage.name}</span>
            </p>
            <img
              src={generatedImage.url}
              alt={generatedImage.name}
              className="w-64 h-64 rounded-lg border border-zinc-700 object-cover"
            />
          </div>
        )}
      </div>

      {/* Gallery of existing images */}
      <div>
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-4">
          Generated Images {images.length > 0 && `(${images.length})`}
        </h2>

        {loadingImages ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
            Loading...
          </div>
        ) : images.length === 0 ? (
          <p className="text-zinc-500 text-sm">No images generated yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((img) => (
              <div
                key={img.slug}
                className="group relative bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
              >
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-2">
                  <p className="text-xs text-zinc-300 truncate capitalize">{img.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
