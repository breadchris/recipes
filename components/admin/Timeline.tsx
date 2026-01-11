'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { formatTime } from '@/lib/admin/utils';
import type { TimelineAnnotation, StepSection, KeywordType } from '@/lib/types/admin';
import { ZoomIn, ZoomOut } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

const KEYWORD_COLORS: Record<KeywordType, string> = {
  ingredient: '#22c55e',
  technique: '#3b82f6',
  equipment: '#f97316',
};

const KEYWORD_BG_COLORS: Record<KeywordType, string> = {
  ingredient: 'bg-green-100 border-green-300',
  technique: 'bg-blue-100 border-blue-300',
  equipment: 'bg-orange-100 border-orange-300',
};

interface TimelineProps {
  currentTime: number;
  duration: number;
  annotations: TimelineAnnotation[];
  sections: StepSection[];
  activeStep: number | null;
  setActiveStep: (step: number | null) => void;
  onJumpToTimestamp: (timestamp: number) => void;
  filterTypes: KeywordType[];
  editingStep?: number | null;
  onStepBoundaryChange?: (step: number, start: number, end: number) => void;
}

interface DragState {
  stepNumber: number;
  edge: 'start' | 'end';
  initialTime: number;
  currentTime: number;
}

export function Timeline({
  currentTime,
  duration,
  annotations,
  sections,
  activeStep,
  setActiveStep,
  onJumpToTimestamp,
  filterTypes,
  editingStep,
  onStepBoundaryChange,
}: TimelineProps) {
  const TIMELINE_PADDING_LEFT = 40;
  const TIMELINE_PADDING_RIGHT = 40;

  const [zoomLevel, setZoomLevel] = useState(1);
  const [visibleStartTime, setVisibleStartTime] = useState(0);
  const [visibleDuration, setVisibleDuration] = useState(duration);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [showHoverIndicator, setShowHoverIndicator] = useState(false);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<TimelineAnnotation | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);

  const filteredAnnotations = annotations.filter((a) => filterTypes.includes(a.type));

  useEffect(() => {
    setVisibleDuration(duration / zoomLevel);
    if (currentTime < visibleStartTime || currentTime > visibleStartTime + visibleDuration) {
      const newStart = Math.max(0, currentTime - visibleDuration / 2);
      setVisibleStartTime(Math.min(newStart, duration - visibleDuration));
    }
  }, [zoomLevel, duration, currentTime, visibleStartTime, visibleDuration]);

  useEffect(() => {
    setVisibleDuration(duration / zoomLevel);
    if (visibleStartTime + visibleDuration > duration) {
      setVisibleStartTime(Math.max(0, duration - visibleDuration));
    }
  }, [duration, zoomLevel, visibleStartTime, visibleDuration]);

  useEffect(() => {
    const buffer = visibleDuration * 0.1;
    if (currentTime < visibleStartTime + buffer) {
      setVisibleStartTime(Math.max(0, currentTime - buffer));
    } else if (currentTime > visibleStartTime + visibleDuration - buffer) {
      setVisibleStartTime(Math.min(duration - visibleDuration, currentTime - visibleDuration + buffer));
    }
  }, [currentTime, visibleStartTime, visibleDuration, duration]);

  const getTimeFromXPosition = (x: number, rect: DOMRect) => {
    if (x < TIMELINE_PADDING_LEFT) return visibleStartTime;
    if (x > rect.width - TIMELINE_PADDING_RIGHT) return visibleStartTime + visibleDuration;
    const timePercent = (x - TIMELINE_PADDING_LEFT) / (rect.width - TIMELINE_PADDING_LEFT - TIMELINE_PADDING_RIGHT);
    return visibleStartTime + timePercent * visibleDuration;
  };

  const handleTimelineHover = (e: React.MouseEvent) => {
    if (!timelineContentRef.current) return;
    const rect = timelineContentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < TIMELINE_PADDING_LEFT || x > rect.width - TIMELINE_PADDING_RIGHT) {
      setShowHoverIndicator(false);
      return;
    }
    setHoverTime(getTimeFromXPosition(x, rect));
    setShowHoverIndicator(true);
  };

  const handleTimelineLeave = () => {
    setShowHoverIndicator(false);
    setHoveredAnnotation(null);
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.annotation-marker, .step-section')) return;
    if (!timelineContentRef.current) return;
    const rect = timelineContentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onJumpToTimestamp(getTimeFromXPosition(x, rect));
  };

  const handleZoomChange = useCallback(
    (newZoom: number) => {
      const clampedZoom = Math.max(1, Math.min(10, newZoom));
      if (clampedZoom > zoomLevel) {
        const centerTime = currentTime;
        const newVisibleDuration = duration / clampedZoom;
        const newStartTime = Math.max(0, Math.min(duration - newVisibleDuration, centerTime - newVisibleDuration / 2));
        setVisibleStartTime(newStartTime);
      }
      setZoomLevel(clampedZoom);
    },
    [zoomLevel, currentTime, duration]
  );

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomDelta = e.deltaY < 0 ? 0.5 : -0.5;
        handleZoomChange(zoomLevel + zoomDelta);
      } else {
        const scrollDelta = (e.deltaX / (el.clientWidth - TIMELINE_PADDING_LEFT - TIMELINE_PADDING_RIGHT)) * visibleDuration;
        setVisibleStartTime(Math.max(0, Math.min(duration - visibleDuration, visibleStartTime + scrollDelta)));
      }
    };
    el.addEventListener('wheel', wheelHandler, { passive: false });
    return () => el.removeEventListener('wheel', wheelHandler);
  }, [zoomLevel, duration, visibleDuration, visibleStartTime, handleZoomChange]);

  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineContentRef.current) return;
      const rect = timelineContentRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newTime = getTimeFromXPosition(x, rect);
      setDragState((prev) => (prev ? { ...prev, currentTime: Math.max(0, Math.min(duration, newTime)) } : null));
    };
    const handleMouseUp = () => {
      if (dragState && onStepBoundaryChange) {
        const section = sections.find((s) => s.stepNumber === dragState.stepNumber);
        if (section) {
          const newStart = dragState.edge === 'start' ? dragState.currentTime : section.startTime;
          const newEnd = dragState.edge === 'end' ? dragState.currentTime : section.endTime;
          if (newEnd - newStart >= 5) {
            onStepBoundaryChange(dragState.stepNumber, newStart, newEnd);
          }
        }
      }
      setDragState(null);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, duration, onStepBoundaryChange, sections]);

  const handleDragStart = useCallback((stepNumber: number, edge: 'start' | 'end', initialTime: number) => {
    setDragState({ stepNumber, edge, initialTime, currentTime: initialTime });
  }, []);

  const getTimePosition = (time: number) => {
    if (time < visibleStartTime || time > visibleStartTime + visibleDuration) return null;
    const timePercent = (time - visibleStartTime) / visibleDuration;
    const contentWidth = timelineContentRef.current?.clientWidth || 0;
    const availableWidth = contentWidth - TIMELINE_PADDING_LEFT - TIMELINE_PADDING_RIGHT;
    return `${TIMELINE_PADDING_LEFT + timePercent * availableWidth}px`;
  };

  const isTimeVisible = (time: number) => time >= visibleStartTime && time <= visibleStartTime + visibleDuration;

  const getMarkerInterval = () => {
    const timelineWidth = timelineRef.current?.clientWidth || 1000;
    if (timelineWidth < 640) return zoomLevel >= 2 ? 60 : 120;
    if (timelineWidth < 1024) return zoomLevel >= 1.5 ? 60 : 90;
    return 60;
  };

  return (
    <Tooltip.Provider delayDuration={100}>
      <div className="w-full border-t border-zinc-700 relative bg-zinc-900">
        <div
          ref={timelineRef}
          className="w-full h-16 sm:h-24 relative overflow-x-auto border-b border-zinc-700 cursor-pointer select-none"
          onClick={handleTimelineClick}
          onMouseMove={handleTimelineHover}
          onMouseLeave={handleTimelineLeave}
        >
          <div ref={timelineContentRef} className="relative h-full w-full">
            <div className="absolute left-[40px] right-[40px] top-1/2 h-0.5 bg-zinc-600" />
            <div className="absolute left-0 top-0 h-full w-[40px] bg-gradient-to-r from-zinc-900 to-transparent z-5 flex items-center justify-center">
              <div className="absolute left-1 top-1/2 -translate-y-1/2 bg-zinc-800/90 px-1 py-0.5 rounded text-xs font-medium text-zinc-300">
                {formatTime(visibleStartTime)}
              </div>
            </div>
            <div className="absolute right-0 top-0 h-full w-[40px] bg-gradient-to-l from-zinc-900 to-transparent z-5 flex items-center justify-center">
              <div className="absolute right-1 top-1/2 -translate-y-1/2 bg-zinc-800/90 px-1 py-0.5 rounded text-xs font-medium text-zinc-300">
                {formatTime(Math.min(visibleStartTime + visibleDuration, duration))}
              </div>
            </div>

            {showHoverIndicator && hoverTime !== null && (() => {
              const pos = getTimePosition(hoverTime);
              if (!pos) return null;
              return (
                <div className="absolute top-0 bottom-0 w-0.5 bg-zinc-500/50 z-20 pointer-events-none" style={{ left: pos }}>
                  <div className="absolute left-0 -translate-x-1/2 bottom-0 px-1 py-0.5 bg-zinc-800/90 border border-zinc-600 shadow-sm rounded text-xs text-zinc-300">
                    {formatTime(hoverTime)}
                  </div>
                </div>
              );
            })()}

            {isTimeVisible(currentTime) && (() => {
              const pos = getTimePosition(currentTime);
              if (!pos) return null;
              return (
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none" style={{ left: pos }}>
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 rounded-b-full bg-red-500 w-4 h-4 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                </div>
              );
            })()}

            {sections.map((section) => {
              const isDragging = dragState?.stepNumber === section.stepNumber;
              const displayStartTime = isDragging && dragState.edge === 'start' ? dragState.currentTime : section.startTime;
              const displayEndTime = isDragging && dragState.edge === 'end' ? dragState.currentTime : section.endTime;
              const startPos = getTimePosition(displayStartTime);
              const endPos = getTimePosition(displayEndTime);
              if (!startPos && !endPos) return null;
              const isActive = activeStep === section.stepNumber;
              const isEditing = editingStep === section.stepNumber;
              const showHandles = isEditing && onStepBoundaryChange;

              return (
                <div
                  key={section.id}
                  className={`step-section absolute top-4 bottom-4 rounded cursor-pointer transition-all z-10
                    ${isActive ? 'bg-blue-500/40 border-2 border-blue-400' : 'bg-zinc-700/40 border border-zinc-600'}
                    ${isEditing ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-zinc-900' : ''}
                    ${isDragging ? 'opacity-75' : ''}
                    hover:bg-blue-500/30`}
                  style={{
                    left: startPos || '40px',
                    width: endPos && startPos ? `${Math.max(20, parseInt(endPos) - parseInt(startPos))}px` : 'auto',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStep(section.stepNumber);
                    onJumpToTimestamp(section.startTime);
                  }}
                  title={`Step ${section.stepNumber}: ${section.title}`}
                >
                  {showHandles && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-400/50 rounded-l z-20"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleDragStart(section.stepNumber, 'start', section.startTime);
                      }}
                    />
                  )}
                  {showHandles && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-400/50 rounded-r z-20"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleDragStart(section.stepNumber, 'end', section.endTime);
                      }}
                    />
                  )}
                  <div className={`absolute left-1 top-0 text-xs font-medium truncate max-w-[calc(100%-8px)] ${isActive ? 'text-blue-200' : 'text-zinc-400'}`}>
                    {section.stepNumber}
                  </div>
                </div>
              );
            })}

            {(() => {
              const markerInterval = getMarkerInterval();
              return Array.from({ length: Math.ceil(visibleDuration / markerInterval) + 1 }).map((_, i) => {
                const markerTime = Math.floor(visibleStartTime / markerInterval) * markerInterval + i * markerInterval;
                if (markerTime > duration || !isTimeVisible(markerTime)) return null;
                const pos = getTimePosition(markerTime);
                if (!pos) return null;
                return (
                  <div key={`marker-${markerTime}`} className="absolute top-1/2 -translate-y-1/2 h-3 w-px bg-zinc-500 pointer-events-none" style={{ left: pos }}>
                    <span className="absolute left-0 -translate-x-1/2 top-4 text-xs text-zinc-500">{formatTime(markerTime)}</span>
                  </div>
                );
              });
            })()}

            {filteredAnnotations.map((annotation) => {
              if (!isTimeVisible(annotation.timestamp)) return null;
              const pos = getTimePosition(annotation.timestamp);
              if (!pos) return null;
              const isActiveAnnotation = activeStep !== null && annotation.stepNumber === activeStep;
              const isInactiveAnnotation = activeStep !== null && annotation.stepNumber !== activeStep;

              return (
                <Tooltip.Root key={annotation.id}>
                  <Tooltip.Trigger asChild>
                    <div
                      className="annotation-marker absolute bottom-2 -translate-x-1/2 cursor-pointer"
                      style={{ left: pos, zIndex: isActiveAnnotation ? 25 : 20 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onJumpToTimestamp(annotation.timestamp);
                      }}
                      onMouseEnter={() => setHoveredAnnotation(annotation)}
                      onMouseLeave={() => setHoveredAnnotation(null)}
                    >
                      <div
                        className={`w-3 h-3 rounded-full hover:scale-150 transition-transform ring-1 ring-zinc-900
                          ${hoveredAnnotation?.id === annotation.id ? 'scale-150' : ''}
                          ${isActiveAnnotation ? 'scale-125 ring-2 shadow-lg' : ''}
                          ${isInactiveAnnotation ? 'opacity-25' : ''}`}
                        style={{
                          backgroundColor: isInactiveAnnotation ? '#71717a' : KEYWORD_COLORS[annotation.type],
                          '--tw-ring-color': isActiveAnnotation ? KEYWORD_COLORS[annotation.type] : undefined,
                        } as React.CSSProperties}
                      />
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className={`max-w-xs p-2 rounded-lg border shadow-lg text-xs z-50 ${KEYWORD_BG_COLORS[annotation.type]}`} sideOffset={5}>
                      <div className="font-medium text-zinc-900">{annotation.keyword}</div>
                      <div className="text-zinc-600 mt-1">{annotation.context}</div>
                      <div className="text-zinc-500 mt-1">Step {annotation.stepNumber} • {formatTime(annotation.timestamp)}</div>
                      <Tooltip.Arrow className="fill-current" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center px-2 sm:px-4 py-1 sm:py-2 border-b border-zinc-700">
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: KEYWORD_COLORS.ingredient }} />
              <span className="text-zinc-400">Ingredients</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: KEYWORD_COLORS.technique }} />
              <span className="text-zinc-400">Techniques</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: KEYWORD_COLORS.equipment }} />
              <span className="text-zinc-400">Equipment</span>
            </div>
          </div>
          <div className="flex sm:hidden items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: KEYWORD_COLORS.ingredient }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: KEYWORD_COLORS.technique }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: KEYWORD_COLORS.equipment }} />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => handleZoomChange(zoomLevel - 0.5)} disabled={zoomLevel <= 1} className="p-1 hover:bg-zinc-700 rounded disabled:opacity-50 text-zinc-400">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-medium w-10 text-center text-zinc-400">{zoomLevel.toFixed(1)}x</span>
            <button onClick={() => handleZoomChange(zoomLevel + 0.5)} disabled={zoomLevel >= 10} className="p-1 hover:bg-zinc-700 rounded disabled:opacity-50 text-zinc-400">
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
