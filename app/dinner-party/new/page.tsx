'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FOOD_OPTIONS = [
  'Italian',
  'Mexican',
  'Thai',
  'Indian',
  'Japanese',
  'Chinese',
  'Mediterranean',
  'American BBQ',
  'Pizza',
  'Sushi',
  'Tacos',
  'Burgers',
  'Other',
];

export default function NewEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [timeWindow, setTimeWindow] = useState('6-9pm');
  const [foodDefault, setFoodDefault] = useState('Italian');
  const [customFood, setCustomFood] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Parse phone numbers (one per line, comma, or semicolon separated)
    const phones = phoneNumbers
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (phones.length === 0) {
      setError('Please enter at least one phone number');
      setLoading(false);
      return;
    }

    const food = foodDefault === 'Other' ? customFood : foodDefault;
    if (!food) {
      setError('Please select or enter a food type');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/dinner-party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: eventName || undefined,
          event_date: eventDate,
          time_window: timeWindow,
          food_default: food,
          guest_phone_numbers: phones,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      // Redirect to the new event page
      router.push(`/dinner-party/${data.event.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
      setLoading(false);
    }
  }

  // Get tomorrow's date as the minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-8">New Dinner Party</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Event Name{' '}
            <span className="text-zinc-500">(optional)</span>
          </label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Dinner at Chris's"
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Date <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            min={minDate}
            required
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Time Window <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value)}
            placeholder="6-9pm"
            required
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded focus:border-violet-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-500">
            e.g., "6pm", "6-9pm", "7:30pm"
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Food Type <span className="text-red-400">*</span>
          </label>
          <select
            value={foodDefault}
            onChange={(e) => setFoodDefault(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded focus:border-violet-500 focus:outline-none"
          >
            {FOOD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {foodDefault === 'Other' && (
            <input
              type="text"
              value={customFood}
              onChange={(e) => setCustomFood(e.target.value)}
              placeholder="Enter food type"
              className="w-full mt-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded focus:border-violet-500 focus:outline-none"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Guest Phone Numbers <span className="text-red-400">*</span>
          </label>
          <textarea
            value={phoneNumbers}
            onChange={(e) => setPhoneNumbers(e.target.value)}
            placeholder="+1 415 555 1234&#10;+1 415 555 5678&#10;..."
            rows={5}
            required
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded focus:border-violet-500 focus:outline-none resize-none"
          />
          <p className="mt-1 text-xs text-zinc-500">
            One phone number per line. US numbers can omit +1.
          </p>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed rounded font-medium"
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
