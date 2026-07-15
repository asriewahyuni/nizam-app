'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Quote,
  Undo,
  Redo,
} from 'lucide-react'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'

interface WysiwygEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  className?: string
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null
  }

  const toggleLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    // cancelled
    if (url === null) {
      return
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const Btn = ({ onClick, active, disabled, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors',
        active && 'bg-slate-200 text-slate-900 font-bold',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 p-2 bg-slate-50 rounded-t-lg">
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
      >
        <Bold size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
      >
        <Italic size={16} />
      </Btn>

      <div className="w-px h-4 bg-slate-300 mx-1" />

      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
      >
        <Heading2 size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
      >
        <Heading3 size={16} />
      </Btn>

      <div className="w-px h-4 bg-slate-300 mx-1" />

      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      >
        <List size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      >
        <ListOrdered size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
      >
        <Quote size={16} />
      </Btn>

      <div className="w-px h-4 bg-slate-300 mx-1" />

      <Btn onClick={toggleLink} active={editor.isActive('link')}>
        <LinkIcon size={16} />
      </Btn>

      <div className="flex-1" />

      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo size={16} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo size={16} />
      </Btn>
    </div>
  )
}

export function WysiwygEditor({
  value,
  onChange,
  minHeight = '250px',
  className,
}: WysiwygEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4],
        },
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 underline cursor-pointer hover:text-indigo-800',
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm sm:prose max-w-none focus:outline-none p-4',
          className
        ),
        style: `min-height: ${minHeight};`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
