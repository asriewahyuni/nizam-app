'use client'

import { useRef, useState } from 'react'
import { Bold, Italic, Link as LinkIcon, List, Image as ImageIcon, Loader2 } from 'lucide-react'
import { uploadLmsMediaAction } from '@/modules/edu/actions/lms-commercial.actions'

interface Props {
  name?: string
  defaultValue?: string
  placeholder?: string
  rows?: number
  className?: string
}

export default function MarkdownEditor({
  name = 'contentMd',
  defaultValue = '',
  placeholder = 'Tuliskan materi di sini...',
  rows = 10,
  className = '',
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [content, setContent] = useState(defaultValue)
  const [isUploading, setIsUploading] = useState(false)

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selected = text.substring(start, end)

    const newText = text.substring(0, start) + before + selected + after + text.substring(end)
    setContent(newText)

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  const handleToolbarClick = (e: React.MouseEvent, type: string) => {
    e.preventDefault()
    switch (type) {
      case 'bold':
        insertText('**', '**')
        break
      case 'italic':
        insertText('*', '*')
        break
      case 'list':
        insertText('- ')
        break
      case 'link':
        insertText('[', '](https://)')
        break
      case 'image':
        fileInputRef.current?.click()
        break
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await uploadLmsMediaAction(null, formData)
      
      if (res.error) {
        alert(res.error)
      } else if (res.url) {
        insertText(`![${file.name}](${res.url}) `)
      }
    } catch (err) {
      console.error(err)
      alert('Gagal mengupload gambar')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <button
          onClick={(e) => handleToolbarClick(e, 'bold')}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
          title="Tebal"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={(e) => handleToolbarClick(e, 'italic')}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
          title="Miring"
        >
          <Italic size={16} />
        </button>
        <button
          onClick={(e) => handleToolbarClick(e, 'list')}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
          title="Daftar"
        >
          <List size={16} />
        </button>
        <button
          onClick={(e) => handleToolbarClick(e, 'link')}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
          title="Tautan"
        >
          <LinkIcon size={16} />
        </button>
        
        <div className="mx-1 h-4 w-px bg-slate-300" />
        
        <button
          onClick={(e) => handleToolbarClick(e, 'image')}
          disabled={isUploading}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
          title="Upload Gambar"
        >
          {isUploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
        </button>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,video/*,application/pdf" 
          onChange={handleFileUpload} 
        />
      </div>
      
      {/* Editor Area */}
      <textarea
        ref={textareaRef}
        name={name}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`w-full min-h-[12rem] resize-y bg-transparent px-3 py-2 text-sm text-slate-800 outline-none ${className}`}
      />
    </div>
  )
}
