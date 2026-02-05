'use client';

import { useState, useEffect } from 'react';
import { useFeatureFlagsStore, type RecipeViewerVariant } from '@/lib/stores/featureFlags';
import { useRecipeProgressStore } from '@/lib/stores/recipeProgress';
import { RecipeViewer } from './recipe-viewer';
import type { VideoWithChannel, Recipe } from '@/lib/types';

// Lazy load experimental variants
import dynamic from 'next/dynamic';

const FocusedStepView = dynamic(() => import('@/components/admin/experiments/variations/FocusedStepView').then(m => ({ default: m.FocusedStepView })), { ssr: false });
const QuickGlanceView = dynamic(() => import('@/components/admin/experiments/variations/QuickGlanceView').then(m => ({ default: m.QuickGlanceView })), { ssr: false });
const VoiceOptimizedView = dynamic(() => import('@/components/admin/experiments/variations/VoiceOptimizedView').then(m => ({ default: m.VoiceOptimizedView })), { ssr: false });
const ProgressTrackerView = dynamic(() => import('@/components/admin/experiments/variations/ProgressTrackerView').then(m => ({ default: m.ProgressTrackerView })), { ssr: false });
const TimerCentricView = dynamic(() => import('@/components/admin/experiments/variations/TimerCentricView').then(m => ({ default: m.TimerCentricView })), { ssr: false });
const AIVoiceAssistantView = dynamic(() => import('@/components/admin/experiments/variations/AIVoiceAssistantView').then(m => ({ default: m.AIVoiceAssistantView })), { ssr: false });

interface RecipeViewerWrapperProps {
  video: VideoWithChannel;
}

export function RecipeViewerWrapper({ video }: RecipeViewerWrapperProps) {
  const [mounted, setMounted] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const { pageFlags } = useFeatureFlagsStore();
  const { getProgress, toggleStep, toggleIngredient } = useRecipeProgressStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the first recipe for experimental views (index 0)
  const recipe = video.recipes?.[0] as Recipe | undefined;
  const recipeIndex = 0;

  // Get progress for this video/recipe
  const progress = recipe ? getProgress(video.id, recipeIndex) : { completedSteps: [], checkedIngredients: [] };

  const handleStepComplete = (stepIndex: number) => {
    if (recipe) {
      toggleStep(video.id, stepIndex, recipeIndex);
    }
  };

  // Don't render variants until client-side to avoid hydration issues
  if (!mounted) {
    return <RecipeViewer video={video} />;
  }

  const variant = pageFlags.recipeViewerVariant as RecipeViewerVariant;

  // Default variant - use the standard RecipeViewer
  if (variant === 'default') {
    return <RecipeViewer video={video} />;
  }

  // No recipe available for experimental views
  if (!recipe) {
    return <RecipeViewer video={video} />;
  }

  // Props for experimental variants
  const variationProps = {
    recipe,
    activeStep,
    completedSteps: progress.completedSteps,
    checkedIngredients: progress.checkedIngredients,
    onStepChange: setActiveStep,
    onStepComplete: handleStepComplete,
  };

  // Render experimental variant with a back button to return to default
  const renderVariant = () => {
    switch (variant) {
      case 'focused-step':
        return <FocusedStepView {...variationProps} />;
      case 'quick-glance':
        return <QuickGlanceView {...variationProps} />;
      case 'voice-optimized':
        return <VoiceOptimizedView {...variationProps} />;
      case 'progress-tracker':
        return <ProgressTrackerView {...variationProps} />;
      case 'timer-centric':
        return <TimerCentricView {...variationProps} />;
      case 'ai-voice-assistant':
        return <AIVoiceAssistantView {...variationProps} />;
      default:
        return <RecipeViewer video={video} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Variant indicator banner (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-violet-600/90 backdrop-blur text-white text-center py-1 text-xs">
          Viewing: <span className="font-semibold">{variant}</span> variant
          <span className="ml-2 opacity-75">| Use the FAB to switch variants</span>
        </div>
      )}
      <div className={process.env.NODE_ENV === 'development' ? 'pt-7' : ''}>
        {renderVariant()}
      </div>
    </div>
  );
}
