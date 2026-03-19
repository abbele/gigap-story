'use client';

// UX: Editor del singolo waypoint.
// Mostra il TiptapEditor per il testo, lo slider durata (1-15s),
// il select transizione e il pulsante "Aggiorna viewport".

import TiptapEditor from './TiptapEditor';
import type { Waypoint } from '@/types/story';

interface WaypointEditorProps {
  waypoint: Waypoint;
  /** Indice 0-based nella lista */
  index: number;
  /** Chiamata quando l'utente modifica qualsiasi campo del waypoint */
  onChange: (updates: Partial<Waypoint>) => void;
  /** Aggiorna il viewport del waypoint alla vista corrente del viewer */
  onCaptureViewport: () => void;
  onClose: () => void;
}

/**
 * @description Form di editing di un singolo waypoint.
 * Integra TiptapEditor per il testo ricco, slider per la durata,
 * select per la transizione e pulsante per aggiornare il viewport.
 *
 * @example
 * <WaypointEditor
 *   waypoint={activeWaypoint}
 *   index={activeIndex}
 *   onChange={(updates) => updateWaypoint(activeWaypoint.id, updates)}
 *   onCaptureViewport={handleCaptureViewport}
 *   onClose={() => setActiveWaypointId(null)}
 * />
 *
 * @see components/editor/EditorShell.tsx
 * @see components/editor/TiptapEditor.tsx
 */
export default function WaypointEditor({
  waypoint,
  index,
  onChange,
  onCaptureViewport,
  onClose,
}: WaypointEditorProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header: indice + chiudi */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#e8c832] block shrink-0" aria-hidden />
          <span className="text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-500">
            Waypoint {index + 1}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[9px] font-mono tracking-widest uppercase text-zinc-600 hover:text-zinc-400 transition-colors"
          aria-label="Chiudi editor waypoint"
        >
          ← Lista
        </button>
      </div>

      {/* Testo ricco */}
      <div>
        <label className="block text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-600 mb-1.5">
          Testo
        </label>
        <TiptapEditor content={waypoint.text} onChange={(html) => onChange({ text: html })} />
      </div>

      {/* Durata */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor={`duration-${waypoint.id}`}
            className="text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-600"
          >
            Durata
          </label>
          <span className="text-[10px] font-mono text-[#e8c832]">{waypoint.duration}s</span>
        </div>
        {/* UX: range input stilizzato Bauhaus — thumb giallo, track scuro */}
        <input
          id={`duration-${waypoint.id}`}
          type="range"
          min={1}
          max={15}
          step={1}
          value={waypoint.duration}
          onChange={(e) => onChange({ duration: parseInt(e.target.value, 10) })}
          className="w-full h-0.5 bg-[#2a2a2a] appearance-none cursor-pointer accent-[#e8c832]"
          aria-valuemin={1}
          aria-valuemax={15}
          aria-valuenow={waypoint.duration}
          aria-valuetext={`${waypoint.duration} secondi`}
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] font-mono text-zinc-700">1s</span>
          <span className="text-[8px] font-mono text-zinc-700">15s</span>
        </div>
      </div>

      {/* Transizione */}
      <div>
        <label
          htmlFor={`transition-${waypoint.id}`}
          className="block text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-600 mb-1.5"
        >
          Transizione
        </label>
        <select
          id={`transition-${waypoint.id}`}
          value={waypoint.transition}
          onChange={(e) => onChange({ transition: e.target.value as Waypoint['transition'] })}
          className="w-full border-2 border-[#2a2a2a] bg-[#111] py-1.5 px-2 text-xs text-[#f0ede8] font-mono focus:outline-none focus:border-zinc-600 transition-colors appearance-none"
        >
          <option value="ease">Ease (fluida)</option>
          <option value="spring">Spring (elastica)</option>
          <option value="linear">Immediata</option>
        </select>
      </div>

      {/* Aggiorna viewport */}
      <button
        type="button"
        onClick={onCaptureViewport}
        className="w-full py-2 border-2 border-[#2a2a2a] text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 font-mono text-[10px] tracking-[0.25em] uppercase transition-colors"
      >
        ⊡ Aggiorna viewport dalla vista corrente
      </button>
    </div>
  );
}
