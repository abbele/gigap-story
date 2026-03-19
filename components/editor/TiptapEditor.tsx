'use client';

// UX: Editor testo ricco basato su Tiptap v3.
// Toolbar minimale Bauhaus: Bold, Italic, Link.
// Il contenuto è serializzato come HTML per essere salvato nel waypoint.text.

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect } from 'react';

interface TiptapEditorProps {
  /** HTML corrente del waypoint */
  content: string;
  /** Chiamata a ogni modifica con il nuovo HTML */
  onChange: (html: string) => void;
}

/**
 * @description Editor testo ricco per il waypoint.
 * Toolbar: grassetto, corsivo, link.
 * Il contenuto è HTML prodotto da Tiptap e reso in StoryPlayer via dangerouslySetInnerHTML.
 *
 * @example
 * <TiptapEditor content={waypoint.text} onChange={(html) => updateWaypoint({ text: html })} />
 *
 * @see components/editor/WaypointEditor.tsx
 * @see components/viewer/StoryPlayer.tsx
 */
export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // UX: disabilita heading e blockquote — troppo strutturali per testi brevi
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        // UX: min-h garantisce un'area cliccabile anche con testo vuoto
        class:
          'prose prose-invert prose-sm max-w-none min-h-[80px] focus:outline-none text-[#f0ede8] font-sans text-sm leading-relaxed px-3 py-2',
      },
    },
    // UX: immediatelyRender=false evita mismatch SSR/client (Tiptap v3)
    immediatelyRender: false,
  });

  // PERF: sincronizza il contenuto quando l'utente cambia waypoint selezionato
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    // UX: evita reset inutili che perderebbero la posizione del cursore
    if (current !== content) {
      editor.commands.setContent(content || '', { emitUpdate: false });
    }
  }, [content, editor]);

  // UX: apre un prompt per inserire l'URL del link — fallback semplice senza dialog custom
  const handleSetLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = (editor.getAttributes('link').href as string) ?? '';
    const url = window.prompt('URL del link (vuoto per rimuovere):', previousUrl);

    if (url === null) return; // annullato

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="border-2 border-[#2a2a2a] focus-within:border-zinc-600 transition-colors">
      {/* Toolbar */}
      <div
        className="flex items-center gap-0 px-1 py-0.5 border-b-2 border-[#2a2a2a]"
        role="toolbar"
        aria-label="Formattazione testo"
      >
        {/* Grassetto */}
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`px-2 py-1 font-mono font-bold text-xs transition-colors ${
            editor?.isActive('bold')
              ? 'text-[#e8c832] bg-[#1a1a1a]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="Grassetto"
          aria-pressed={editor?.isActive('bold')}
          title="Grassetto (Ctrl+B)"
        >
          B
        </button>

        {/* Corsivo */}
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 font-mono italic text-xs transition-colors ${
            editor?.isActive('italic')
              ? 'text-[#e8c832] bg-[#1a1a1a]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="Corsivo"
          aria-pressed={editor?.isActive('italic')}
          title="Corsivo (Ctrl+I)"
        >
          I
        </button>

        {/* Link */}
        <button
          type="button"
          onClick={handleSetLink}
          className={`px-2 py-1 font-mono text-xs transition-colors ${
            editor?.isActive('link')
              ? 'text-[#e8c832] bg-[#1a1a1a]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="Aggiungi link"
          aria-pressed={editor?.isActive('link')}
          title="Link"
        >
          ↗
        </button>
      </div>

      {/* Area di testo */}
      <EditorContent editor={editor} />
    </div>
  );
}
