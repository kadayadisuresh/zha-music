'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { usePlaybackStore, Track } from '@/lib/stores/playbackStore';
import { QueueItem } from './QueueItem';
import { QueueDivider } from './QueueDivider';

export const QueueList: React.FC = () => {
  const { queue, queueIndex, reorderQueue, removeFromQueue, playTrack, setQueueIndex, dividerIndex, toggleAutoplay, autoplayEnabled } = usePlaybackStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = queue.findIndex((t) => t.queueId === active.id);
      const newIndex = queue.findIndex((t) => t.queueId === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // Constraint: Don't allow manual tracks to be reordered into the autoplay section
        if (dividerIndex !== -1) {
           if (oldIndex < dividerIndex && newIndex >= dividerIndex) return;
           if (oldIndex >= dividerIndex && newIndex < dividerIndex) return;
        }
        reorderQueue(oldIndex, newIndex);
      }
    }
  };

  const handleClearAutoplay = () => {
    // Only remove autoplay tracks
    const autoplayItems = queue.reduce((acc, t, i) => t.isAutoplay ? [...acc, i] : acc, [] as number[]);
    autoplayItems.reverse().forEach(idx => removeFromQueue(idx));
  };

  const handlePlay = (track: Track, index: number) => {
    setQueueIndex(index);
    playTrack(track);
  };

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-white/40 gap-2">
        <p className="text-sm">Queue is empty</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 pb-24">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={queue.map((t) => t.queueId || '')}
          strategy={verticalListSortingStrategy}
        >
          {queue.map((track, index) => (
            <React.Fragment key={track.queueId || index}>
              {index === dividerIndex && (
                <QueueDivider 
                  autoplayEnabled={autoplayEnabled} 
                  onToggleAutoplay={toggleAutoplay}
                  onClearAutoplay={handleClearAutoplay}
                />
              )}
              <QueueItem
                track={track}
                index={index}
                isActive={index === queueIndex}
                onRemove={removeFromQueue}
                onPlay={handlePlay}
              />
            </React.Fragment>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};
