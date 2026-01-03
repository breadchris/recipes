'use client';

import { useEffect, useRef } from 'react';
import { formatTime } from '@/lib/admin/utils';
import type { AdminInstruction, KeywordType } from '@/lib/types/admin';
import { Pencil, Check, Trash2, CheckCircle, MinusCircle, AlertCircle, XCircle } from 'lucide-react';

const KEYWORD_CLASSES: Record<KeywordType, string> = {
  ingredient: 'bg-green-900/50 text-green-300 border-green-700',
  technique: 'bg-blue-900/50 text-blue-300 border-blue-700',
  equipment: 'bg-orange-900/50 text-orange-300 border-orange-700',
};

const MEASUREMENT_CLASSES = {
  temperature: 'bg-red-900/50 text-red-300 border-red-700',
  amount: 'bg-purple-900/50 text-purple-300 border-purple-700',
  time: 'bg-teal-900/50 text-teal-300 border-teal-700',
};

const CONFIDENCE_STYLES = {
  high: { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700' },
  medium: { bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-700' },
  low: { bg: 'bg-orange-900/50', text: 'text-orange-300', border: 'border-orange-700' },
  none: { bg: 'bg-zinc-800/50', text: 'text-zinc-400', border: 'border-zinc-600' },
};

const CONFIDENCE_ICONS = {
  high: CheckCircle,
  medium: MinusCircle,
  low: AlertCircle,
  none: XCircle,
};

const CONFIDENCE_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' | 'none' | undefined }) {
  const safeConfidence = confidence ?? 'none';
  const style = CONFIDENCE_STYLES[safeConfidence];
  const Icon = CONFIDENCE_ICONS[safeConfidence];
  const label = CONFIDENCE_LABELS[safeConfidence];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border ${style.bg} ${style.text} ${style.border}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

interface StepListProps {
  instructions: AdminInstruction[];
  activeStep: number | null;
  currentTime: number;
  onStepClick: (step: number, startTime: number) => void;
  filterTypes: KeywordType[];
  onToggleFilter: (type: KeywordType) => void;
  editingStep?: number | null;
  onEditStep?: (step: number | null) => void;
  onNotesChange?: (step: number, notes: string) => void;
  onTextChange?: (step: number, text: string) => void;
  onDeleteStep?: (step: number) => void;
  onBoundaryChange?: (step: number, start: number, end: number) => void;
  pendingNotes?: Map<number, string>;
  pendingText?: Map<number, string>;
  deletedSteps?: Set<number>;
  pendingBoundaries?: Map<number, { timestamp_seconds?: number; end_time_seconds?: number }>;
}

export function StepList({
  instructions,
  activeStep,
  currentTime,
  onStepClick,
  filterTypes,
  onToggleFilter,
  editingStep,
  onEditStep,
  onNotesChange,
  onTextChange,
  onDeleteStep,
  pendingNotes,
  pendingText,
  deletedSteps,
  pendingBoundaries,
}: StepListProps) {
  const currentStepByTime = instructions.find(
    (inst) =>
      inst.timestamp_seconds !== undefined &&
      inst.end_time_seconds !== undefined &&
      currentTime >= inst.timestamp_seconds &&
      currentTime < inst.end_time_seconds
  )?.step;

  const stepRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (activeStep !== null) {
      const stepEl = stepRefs.current.get(activeStep);
      stepEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeStep]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        {instructions.map((instruction) => {
          const isDeleted = deletedSteps?.has(instruction.step);
          if (isDeleted) return null;

          const isActive = activeStep === instruction.step;
          const isCurrentByTime = currentStepByTime === instruction.step;
          const isEditing = editingStep === instruction.step;
          const pendingBoundary = pendingBoundaries?.get(instruction.step);
          const startTime = pendingBoundary?.timestamp_seconds ?? instruction.timestamp_seconds ?? 0;
          const endTime = pendingBoundary?.end_time_seconds ?? instruction.end_time_seconds ?? 0;
          const duration = endTime - startTime;
          const hasPendingBoundary = !!pendingBoundary;
          const hasTimestamp = (pendingBoundary?.timestamp_seconds !== undefined && pendingBoundary.timestamp_seconds > 0) ||
            (instruction.timestamp_seconds !== undefined && instruction.timestamp_seconds > 0) ||
            (pendingBoundary?.end_time_seconds !== undefined && pendingBoundary.end_time_seconds > 0) ||
            (instruction.end_time_seconds !== undefined && instruction.end_time_seconds > 0);
          const refCount = instruction.video_references?.length || 0;
          const currentNotes = pendingNotes?.get(instruction.step) ?? instruction.notes ?? '';
          const currentText = pendingText?.get(instruction.step) ?? instruction.text;
          const hasTextChange = pendingText?.has(instruction.step);

          return (
            <div
              key={instruction.step}
              ref={(el) => {
                if (el) stepRefs.current.set(instruction.step, el);
              }}
              className={`p-3 border-b border-zinc-700 cursor-pointer transition-all hover:bg-zinc-800
                ${isActive ? 'bg-blue-900/30 border-l-4 border-l-blue-500' : ''}
                ${isCurrentByTime && !isActive ? 'bg-yellow-900/20 border-l-4 border-l-yellow-500' : ''}`}
              onClick={() => onStepClick(instruction.step, startTime)}
            >
              <div className="flex items-start gap-2 mb-2">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${isActive ? 'bg-blue-500 text-white' : isCurrentByTime ? 'bg-yellow-500 text-white' : 'bg-zinc-700 text-zinc-300'}`}
                >
                  {instruction.step}
                </div>
                <div className="flex-1">
                  {isEditing && onTextChange ? (
                    <textarea
                      value={currentText}
                      onChange={(e) => onTextChange(instruction.step, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full p-2 text-sm border border-zinc-600 rounded bg-zinc-900 text-zinc-200 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  ) : (
                    <span className="text-sm text-zinc-200">
                      {currentText}
                      {hasTextChange && <span className="ml-2 text-blue-400 text-xs">(edited)</span>}
                    </span>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  {onEditStep && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditStep(isEditing ? null : instruction.step);
                      }}
                      className={`p-1 rounded hover:bg-zinc-700 transition-colors ${
                        isEditing ? 'text-blue-400' : 'text-zinc-500'
                      }`}
                      title={isEditing ? 'Done editing' : 'Edit step'}
                    >
                      {isEditing ? <Check size={14} /> : <Pencil size={14} />}
                    </button>
                  )}
                  {onDeleteStep && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteStep(instruction.step);
                      }}
                      className="p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-500 hover:text-red-400"
                      title="Delete step"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className={`flex items-center gap-2 text-xs mb-2 ml-8 ${hasPendingBoundary ? 'text-blue-400' : 'text-zinc-500'}`}>
                <ConfidenceBadge confidence={instruction.timing_confidence} />
                {hasTimestamp ? (
                  <>
                    <span>{formatTime(startTime)}</span>
                    <span>-</span>
                    <span>{formatTime(endTime)}</span>
                    <span className={hasPendingBoundary ? 'text-blue-500' : 'text-zinc-600'}>({Math.round(duration)}s)</span>
                    {hasPendingBoundary && <span className="text-blue-400 font-medium">(edited)</span>}
                  </>
                ) : (
                  <span className="text-amber-500 italic">No timestamp set</span>
                )}
                {refCount > 0 && <span className="text-zinc-600">• {refCount} refs</span>}
              </div>

              {instruction.keywords && (
                <div className="ml-8 flex flex-wrap gap-1">
                  {filterTypes.includes('ingredient') &&
                    instruction.keywords.ingredients?.map((ingredient, idx) => {
                      // Find matching amount that contains this ingredient
                      const matchingAmount = instruction.measurements?.amounts?.find(
                        (amt) => amt.toLowerCase().includes(ingredient.toLowerCase())
                      );
                      return (
                        <span key={`ing-${idx}`} className={`px-1.5 py-0.5 text-xs rounded border ${KEYWORD_CLASSES.ingredient}`}>
                          {matchingAmount || ingredient}
                        </span>
                      );
                    })}
                  {filterTypes.includes('technique') &&
                    instruction.keywords.techniques?.map((keyword, idx) => (
                      <span key={`tech-${idx}`} className={`px-1.5 py-0.5 text-xs rounded border ${KEYWORD_CLASSES.technique}`}>
                        {keyword}
                      </span>
                    ))}
                  {filterTypes.includes('equipment') &&
                    instruction.keywords.equipment?.map((keyword, idx) => (
                      <span key={`equip-${idx}`} className={`px-1.5 py-0.5 text-xs rounded border ${KEYWORD_CLASSES.equipment}`}>
                        {keyword}
                      </span>
                    ))}
                </div>
              )}

              {instruction.measurements && (
                <div className="ml-8 mt-1 flex flex-wrap gap-1">
                  {instruction.measurements.temperatures?.map((temp, idx) => (
                    <span key={`temp-${idx}`} className={`px-1.5 py-0.5 text-xs rounded border ${MEASUREMENT_CLASSES.temperature}`}>
                      {temp}
                    </span>
                  ))}
                  {instruction.measurements.amounts?.map((amount, idx) => (
                    <span key={`amt-${idx}`} className={`px-1.5 py-0.5 text-xs rounded border ${MEASUREMENT_CLASSES.amount}`}>
                      {amount}
                    </span>
                  ))}
                  {instruction.measurements.times?.map((time, idx) => (
                    <span key={`time-${idx}`} className={`px-1.5 py-0.5 text-xs rounded border ${MEASUREMENT_CLASSES.time}`}>
                      {time}
                    </span>
                  ))}
                </div>
              )}

              {!isEditing && instruction.notes && (
                <div className="ml-8 mt-2 text-xs text-amber-400 italic">
                  Note: {instruction.notes.length > 50 ? instruction.notes.slice(0, 50) + '...' : instruction.notes}
                </div>
              )}

              {isEditing && onNotesChange && (
                <div className="ml-8 mt-3 p-3 bg-zinc-800 rounded-lg border border-zinc-700" onClick={(e) => e.stopPropagation()}>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Notes for AI regeneration</label>
                  <textarea
                    value={currentNotes}
                    onChange={(e) => onNotesChange(instruction.step, e.target.value)}
                    className="w-full p-2 text-sm border border-zinc-600 rounded bg-zinc-900 text-zinc-200 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Add corrections or guidance for the AI..."
                  />
                  <div className="mt-2 text-xs text-zinc-500">
                    Drag timeline handles or select transcript text to adjust time range
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
