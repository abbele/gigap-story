'use client';

// UX: Editor del singolo waypoint.
// Mostra il TiptapEditor per il testo, lo slider durata (1-15s),
// il select transizione e il pulsante "Aggiorna viewport".
// AI (fase 7): pulsante opzionale "Suggerisci testo" — usa onSuggestText se fornito.
// AI (fase 9): pulsante "Connessioni" — trova opere visivamente simili al crop del waypoint.

import { useState } from 'react';
import TiptapEditor from './TiptapEditor';
import type { Waypoint } from '@/types/story';
import type { SimilarityResult } from '@/lib/ai/similarity';

interface WaypointEditorProps {
  waypoint: Waypoint;
  /** Indice 0-based nella lista */
  index: number;
  /** Chiamata quando l'utente modifica qualsiasi campo del waypoint */
  onChange: (updates: Partial<Waypoint>) => void;
  /** Aggiorna il viewport del waypoint alla vista corrente del viewer */
  onCaptureViewport: () => void;
  onClose: () => void;
  /** AI: callback che chiama /api/ai/suggest — undefined se AI non configurata */
  onSuggestText?: () => Promise<string>;
  /** AI (fase 9): callback che cerca opere visivamente simili — undefined se indice non generato */
  onFindSimilar?: (imageBase64: string) => Promise<SimilarityResult[]>;
  /** AI (fase 9): callback che genera la spiegazione testuale di una connessione visiva */
  onExplainConnection?: (result: SimilarityResult) => Promise<string>;
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
  onSuggestText,
  onFindSimilar,
  onExplainConnection,
}: WaypointEditorProps) {
  // AI (fase 7): stato locale per loading/errore del suggerimento testo
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // AI (fase 9): stato locale per la ricerca di similarità visiva
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);
  const [similarResults, setSimilarResults] = useState<SimilarityResult[] | null>(null);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(false);

  const handleSuggest = async () => {
    if (!onSuggestText) return;
    setIsSuggesting(true);
    setSuggestError(null);
    try {
      const text = await onSuggestText();
      onChange({ text });
    } catch {
      setSuggestError('Errore generazione testo');
    } finally {
      setIsSuggesting(false);
    }
  };

  // AI (fase 9): mappa artworkId → spiegazione generata e stato di loading per card
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loadingExplanations, setLoadingExplanations] = useState<Record<string, boolean>>({});

  // AI (fase 9): genera la spiegazione testuale della connessione visiva per una singola card
  const handleExplain = async (result: SimilarityResult) => {
    if (!onExplainConnection) return;
    setLoadingExplanations((prev) => ({ ...prev, [result.artworkId]: true }));
    try {
      const explanation = await onExplainConnection(result);
      setExplanations((prev) => ({ ...prev, [result.artworkId]: explanation }));
    } catch {
      setExplanations((prev) => ({
        ...prev,
        [result.artworkId]: 'Errore generazione spiegazione',
      }));
    } finally {
      setLoadingExplanations((prev) => ({ ...prev, [result.artworkId]: false }));
    }
  };

  // AI (fase 9): cerca opere simili al crop del waypoint
  const handleFindConnections = async () => {
    if (!onFindSimilar || !waypoint.thumbnailDataUrl) return;
    setIsFindingSimilar(true);
    setSimilarError(null);
    setShowConnections(true);
    try {
      const results = await onFindSimilar(waypoint.thumbnailDataUrl);
      setSimilarResults(results);
    } catch (err) {
      setSimilarError(err instanceof Error ? err.message : 'Errore ricerca similarità');
    } finally {
      setIsFindingSimilar(false);
    }
  };

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
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-600">
            Testo
          </label>
          {/* AI: pulsante suggerisci — visibile solo se il provider è configurato */}
          {onSuggestText && (
            <button
              type="button"
              onClick={handleSuggest}
              disabled={isSuggesting}
              className="text-[9px] font-mono tracking-widest uppercase text-zinc-600 hover:text-[#e8c832] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSuggesting ? '… generando' : '✦ Suggerisci'}
            </button>
          )}
        </div>
        <TiptapEditor content={waypoint.text} onChange={(html) => onChange({ text: html })} />
        {suggestError && <p className="mt-1 text-[9px] font-mono text-red-500">{suggestError}</p>}
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

      {/* AI (fase 9): pannello connessioni visive — visibile solo se il waypoint ha un thumbnail */}
      {onFindSimilar && waypoint.thumbnailDataUrl && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={showConnections ? () => setShowConnections(false) : handleFindConnections}
            disabled={isFindingSimilar}
            className="w-full py-2 border-2 border-[#2a2a2a] text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 font-mono text-[10px] tracking-[0.25em] uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isFindingSimilar
              ? '… cercando'
              : showConnections
                ? '✕ Nascondi connessioni'
                : '⬡ Connessioni visive'}
          </button>

          {similarError && (
            <p className="text-[9px] font-mono text-red-500 text-center">{similarError}</p>
          )}

          {showConnections && similarResults && similarResults.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-600">
                {similarResults.length} opere simili
              </span>
              {/* PERF: griglia 2 colonne — thumbnail 80×60 + metadati */}
              <div className="flex flex-col gap-2">
                {similarResults.map((r) => (
                  <div
                    key={r.artworkId}
                    className="border border-[#2a2a2a] p-1.5 flex flex-col gap-1"
                  >
                    <div className="flex gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.thumbnailUrl}
                        alt={r.title}
                        width={56}
                        height={42}
                        className="w-14 h-11 object-cover bg-[#1a1a1a] shrink-0"
                        loading="lazy"
                      />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p className="text-[8px] font-mono text-zinc-400 leading-snug line-clamp-2">
                          {r.title}
                        </p>
                        <p className="text-[8px] font-mono text-zinc-600 truncate">{r.artist}</p>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-[7px] font-mono text-zinc-700 uppercase tracking-widest">
                            {r.provider}
                          </span>
                          <span className="text-[8px] font-mono text-[#e8c832]">
                            {Math.round(r.similarity * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* AI (fase 9): spiegazione testuale della connessione visiva */}
                    {onExplainConnection &&
                      (explanations[r.artworkId] ? (
                        <p className="text-[8px] font-mono text-zinc-500 leading-relaxed border-t border-[#2a2a2a] pt-1 mt-0.5">
                          {explanations[r.artworkId]}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleExplain(r)}
                          disabled={loadingExplanations[r.artworkId]}
                          className="text-[7px] font-mono tracking-widest uppercase text-zinc-700 hover:text-[#e8c832] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                        >
                          {loadingExplanations[r.artworkId]
                            ? '… generando'
                            : '✦ Spiega connessione'}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showConnections &&
            similarResults &&
            similarResults.length === 0 &&
            !isFindingSimilar && (
              <p className="text-[9px] font-mono text-zinc-700 text-center">
                Nessuna connessione trovata
              </p>
            )}
        </div>
      )}
    </div>
  );
}
