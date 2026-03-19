'use client';

// UX: Lista waypoint riordinabile via drag-and-drop.
// Usa @dnd-kit/sortable per il DnD accessibile da tastiera.
// Ogni waypoint mostra: thumbnail, indice, anteprima testo, durata.

import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Waypoint } from '@/types/story';

// ── WaypointCard sortable ───────────────────────────────────────────

interface WaypointCardProps {
  waypoint: Waypoint;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

/**
 * @description Singola card waypoint con handle drag-and-drop.
 * Mostra thumbnail, numero, anteprima testo troncato e durata.
 */
function WaypointCard({ waypoint, index, isActive, onSelect, onDelete }: WaypointCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: waypoint.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // UX: riduce opacità durante il trascinamento per feedback visivo
    opacity: isDragging ? 0.5 : 1,
  };

  // UX: testo del waypoint come testo puro (rimuove tag HTML) per l'anteprima
  const plainText = waypoint.text.replace(/<[^>]*>/g, '').trim();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch gap-0 border-2 transition-colors cursor-pointer ${
        isActive ? 'border-[#e8c832]' : 'border-[#2a2a2a] hover:border-zinc-600'
      }`}
    >
      {/* Handle drag — area di trascinamento */}
      <div
        {...attributes}
        {...listeners}
        className="w-6 flex items-center justify-center bg-[#111] border-r-2 border-[#2a2a2a] cursor-grab active:cursor-grabbing shrink-0"
        aria-label={`Trascina waypoint ${index + 1}`}
      >
        <span className="text-zinc-600 text-[10px] select-none">⠿</span>
      </div>

      {/* Contenuto card — click per selezionare */}
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-start gap-2 px-2 py-2 text-left min-w-0"
        aria-label={`Modifica waypoint ${index + 1}`}
      >
        {/* Thumbnail */}
        <div className="w-10 h-10 shrink-0 bg-[#111] border border-[#2a2a2a] overflow-hidden">
          {waypoint.thumbnailDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={waypoint.thumbnailDataUrl}
              alt={`Anteprima waypoint ${index + 1}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[10px] font-mono text-zinc-700">{index + 1}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`text-[8px] font-mono tracking-widest uppercase ${
                isActive ? 'text-[#e8c832]' : 'text-zinc-600'
              }`}
            >
              {index + 1}
            </span>
            <span className="text-[8px] font-mono text-zinc-700">{waypoint.duration}s</span>
          </div>
          <p className="text-[10px] font-mono text-zinc-400 truncate leading-snug">
            {plainText || <span className="text-zinc-700 italic">Testo vuoto</span>}
          </p>
        </div>
      </button>

      {/* Elimina */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="shrink-0 w-7 flex items-center justify-center text-zinc-700 hover:text-red-500 transition-colors border-l-2 border-[#2a2a2a]"
        aria-label={`Elimina waypoint ${index + 1}`}
      >
        <span className="text-xs font-mono">✕</span>
      </button>
    </div>
  );
}

// ── WaypointList ────────────────────────────────────────────────────

interface WaypointListProps {
  waypoints: Waypoint[];
  activeWaypointId: string | null;
  onReorder: (waypoints: Waypoint[]) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * @description Lista drag-and-drop dei waypoint della storia.
 * Usa DndContext + SortableContext di @dnd-kit per il riordino.
 * Il riordino è accessibile anche da tastiera (Tab + Spazio + Frecce).
 *
 * @example
 * <WaypointList
 *   waypoints={waypoints}
 *   activeWaypointId={activeId}
 *   onReorder={setWaypoints}
 *   onSelect={setActiveWaypointId}
 *   onDelete={(id) => setWaypoints(prev => prev.filter(w => w.id !== id))}
 * />
 *
 * @see components/editor/EditorShell.tsx
 */
export default function WaypointList({
  waypoints,
  activeWaypointId,
  onReorder,
  onSelect,
  onDelete,
}: WaypointListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // UX: delay minimo per distinguere click da drag
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = waypoints.findIndex((w) => w.id === active.id);
      const newIndex = waypoints.findIndex((w) => w.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      onReorder(arrayMove(waypoints, oldIndex, newIndex));
    },
    [waypoints, onReorder],
  );

  if (waypoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div className="w-6 h-6 border-2 border-[#2a2a2a]" aria-hidden />
        <p className="text-[9px] font-mono text-zinc-600 text-center uppercase tracking-widest">
          Nessun waypoint
          <br />
          Clicca &quot;Cattura vista&quot; per iniziare
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={waypoints.map((w) => w.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5" role="list" aria-label="Lista waypoint">
          {waypoints.map((waypoint, i) => (
            <WaypointCard
              key={waypoint.id}
              waypoint={waypoint}
              index={i}
              isActive={waypoint.id === activeWaypointId}
              onSelect={() => onSelect(waypoint.id)}
              onDelete={() => onDelete(waypoint.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
