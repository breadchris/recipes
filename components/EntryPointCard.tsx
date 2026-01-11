'use client';

import { ReactNode } from 'react';

export interface EntryPointConfig {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  // Filter params applied when clicked (null opens Pantry Mode)
  filters: {
    meal_type?: string[];
    difficulty?: string[];
    total_time_max?: number;
    dietary_tags?: string[];
  } | null;
  // Gradient colors (from -> to)
  gradient: {
    from: string;
    to: string;
    darkFrom: string;
    darkTo: string;
  };
}

// Entry point configurations
export const ENTRY_POINTS: EntryPointConfig[] = [
  {
    id: 'dinner',
    icon: '🍳',
    title: "What's for dinner?",
    subtitle: 'Evening meals ready in under an hour',
    filters: {
      meal_type: ['dinner'],
      total_time_max: 60,
    },
    gradient: {
      from: 'from-amber-50',
      to: 'to-orange-100',
      darkFrom: 'dark:from-amber-950/40',
      darkTo: 'dark:to-orange-900/30',
    },
  },
  {
    id: 'quick',
    icon: '⚡',
    title: 'Quick & Easy',
    subtitle: 'Ready in 30 minutes or less',
    filters: {
      total_time_max: 30,
      difficulty: ['easy'],
    },
    gradient: {
      from: 'from-yellow-50',
      to: 'to-lime-100',
      darkFrom: 'dark:from-yellow-950/40',
      darkTo: 'dark:to-lime-900/30',
    },
  },
  {
    id: 'pantry',
    icon: '🎯',
    title: 'Use What I Have',
    subtitle: 'Find recipes with your ingredients',
    filters: null, // Opens Pantry Mode
    gradient: {
      from: 'from-slate-50',
      to: 'to-blue-100',
      darkFrom: 'dark:from-slate-950/40',
      darkTo: 'dark:to-blue-900/30',
    },
  },
  {
    id: 'healthy',
    icon: '🌿',
    title: 'Eating Light',
    subtitle: 'Vegetarian & healthy options',
    filters: {
      dietary_tags: ['vegetarian', 'healthy', 'light'],
    },
    gradient: {
      from: 'from-green-50',
      to: 'to-teal-100',
      darkFrom: 'dark:from-green-950/40',
      darkTo: 'dark:to-teal-900/30',
    },
  },
  {
    id: 'impress',
    icon: '🎉',
    title: 'Impress Someone',
    subtitle: 'Special occasion worthy dishes',
    filters: {
      difficulty: ['medium', 'hard'],
    },
    gradient: {
      from: 'from-purple-50',
      to: 'to-pink-100',
      darkFrom: 'dark:from-purple-950/40',
      darkTo: 'dark:to-pink-900/30',
    },
  },
];

interface EntryPointCardProps {
  config: EntryPointConfig;
  onClick: (config: EntryPointConfig) => void;
}

export function EntryPointCard({ config, onClick }: EntryPointCardProps) {
  const { icon, title, subtitle, gradient } = config;

  return (
    <button
      onClick={() => onClick(config)}
      className={`
        w-full p-5 rounded-xl text-left transition-all duration-200
        bg-gradient-to-br ${gradient.from} ${gradient.to} ${gradient.darkFrom} ${gradient.darkTo}
        hover:scale-[1.02] hover:shadow-lg
        active:scale-[0.98]
        border border-zinc-200/50 dark:border-zinc-700/50
      `}
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-1">
        {title}
      </h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {subtitle}
      </p>
    </button>
  );
}

interface EntryPointGridProps {
  onSelect: (config: EntryPointConfig) => void;
}

export function EntryPointGrid({ onSelect }: EntryPointGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {ENTRY_POINTS.map((config) => (
        <EntryPointCard
          key={config.id}
          config={config}
          onClick={onSelect}
        />
      ))}
    </div>
  );
}
