'use client';

import type { MuseumProvider } from '@/types/museum';

interface MuseumFilterProps {
  /** Provider attualmente selezionati (array vuoto = tutti) */
  selected: MuseumProvider[];
  onChange: (providers: MuseumProvider[]) => void;
  /** Numero totale di opere trovate, per il contatore */
  total?: number;
}

// UX: etichette leggibili per ogni provider
const MUSEUM_LABELS: Record<MuseumProvider, { short: string; full: string }> = {
  chicago: { short: 'AIC', full: 'Art Institute of Chicago' },
  rijksmuseum: { short: 'RKS', full: 'Rijksmuseum' },
  wellcome: { short: 'WC', full: 'Wellcome Collection' },
  ycba: { short: 'YCBA', full: 'Yale Center for British Art' },
};

const ALL_PROVIDERS: MuseumProvider[] = ['chicago', 'rijksmuseum', 'wellcome', 'ycba'];

/**
 * @description Filtri a chip per selezionare uno o più musei.
 * Selezione multipla: ogni chip fa toggle del provider corrispondente.
 * Nessuna selezione = mostra opere da tutti i musei.
 *
 * @example
 * <MuseumFilter selected={providers} onChange={setProviders} total={342} />
 */
export default function MuseumFilter({ selected, onChange, total }: MuseumFilterProps) {
  function toggle(provider: MuseumProvider) {
    if (selected.includes(provider)) {
      onChange(selected.filter((p) => p !== provider));
    } else {
      onChange([...selected, provider]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ALL_PROVIDERS.map((provider) => {
        const isSelected = selected.includes(provider);
        return (
          <button
            key={provider}
            type="button"
            onClick={() => toggle(provider)}
            title={MUSEUM_LABELS[provider].full}
            className={`px-3 py-1.5 text-[10px] font-mono font-bold tracking-[0.2em] uppercase transition-colors border-2 ${
              isSelected
                ? 'bg-[#e8c832] text-black border-[#e8c832]'
                : 'bg-transparent text-zinc-500 border-[#2a2a2a] hover:border-zinc-500 hover:text-zinc-300'
            }`}
          >
            {MUSEUM_LABELS[provider].short}
          </button>
        );
      })}

      {/* UX: contatore totale risultati — aiuta l'utente a capire l'impatto dei filtri */}
      {total !== undefined && (
        <span className="ml-auto text-[10px] font-mono text-zinc-600 tracking-widest uppercase">
          {total.toLocaleString('it-IT')} opere
        </span>
      )}
    </div>
  );
}
