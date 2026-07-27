'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createLmsLesson, uploadLmsMediaAction } from '@/modules/edu/actions/lms-commercial.actions'
import { BookOpen, FileText, Upload, Loader2 } from 'lucide-react'
import { WysiwygEditor } from '../WysiwygEditor'

const inputCls = 'w-full rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-600 focus:ring-0 hover:border-slate-300'
const labelCls = 'block text-sm font-bold text-slate-900 mb-1.5'

export default function CreateLessonForm({ courseId }: { courseId: string }) {
  const [state, action, isPending] = useActionState(createLmsLesson, {})
  const formRef = useRef<HTMLFormElement>(null)
  const [lessonType, setLessonType] = useState('TEXT')
  const [videoUrl, setVideoUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [contentHtml, setContentHtml] = useState('')

  // Attachment & Links state
  const [attachments, setAttachments] = useState<{ type: 'attachment' | 'link'; url: string; name: string }[]>([])
  const [newLinkName, setNewLinkName] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const attachmentFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      setLessonType('TEXT')
      setVideoUrl('')
      setContentHtml('')
      setAttachments([])
    }
  }, [state])

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await uploadLmsMediaAction(null, formData)
      
      if (res?.success && res.url) {
        setVideoUrl(res.url)
      } else {
        alert(res?.error || 'Failed to upload video')
      }
    } catch (err) {
      alert('Failed to upload video')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await uploadLmsMediaAction(null, formData)
      
      if (res?.success && res.url) {
        setAttachments([
          ...attachments,
          { type: 'attachment', url: res.url, name: file.name }
        ])
      } else {
        alert(res?.error || 'Failed to upload file')
      }
    } catch (err) {
      alert('Failed to upload file')
    } finally {
      setIsUploadingFile(false)
      if (attachmentFileInputRef.current) attachmentFileInputRef.current.value = ''
    }
  }

  const handleAddLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) {
      alert('Please enter both link name and URL')
      return
    }
    let url = newLinkUrl.trim()
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url
    }
    setAttachments([
      ...attachments,
      { type: 'link', url, name: newLinkName.trim() }
    ])
    setNewLinkName('')
    setNewLinkUrl('')
  }

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
          Lesson created successfully.
        </div>
      )}

      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="attachmentsJson" value={JSON.stringify(attachments)} />

      <div>
        <label className={labelCls}>Lesson Title <span className="text-red-400">*</span></label>
        <input name="title" required placeholder="e.g. Chapter 1 - Introduction" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Lesson Type</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'TEXT', label: 'Text / Article',  Icon: FileText },
            { value: 'VIDEO',  label: 'Video',   Icon: BookOpen },
          ] as const).map(({ value, label, Icon }) => (
            <label key={value} className="cursor-pointer">
              <input 
                type="radio" 
                name="lessonType" 
                value={value} 
                checked={lessonType === value}
                onChange={() => setLessonType(value)}
                className="sr-only peer" 
              />
              <div className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-center text-xs font-semibold text-slate-500 transition-all duration-150 cursor-pointer peer-checked:border-slate-800 peer-checked:bg-slate-900 peer-checked:text-white hover:border-slate-300">
                <Icon className="h-4 w-4" />
                {label}
              </div>
            </label>
          ))}
        </div>
      </div>

      {lessonType === 'VIDEO' && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <label className={labelCls}>Video URL (YouTube / S3) <span className="text-red-400">*</span></label>
          <div className="flex gap-2">
            <input 
              name="videoUrl" 
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required 
              placeholder="e.g. https://youtube.com/watch?v=..." 
              className={inputCls} 
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="video/*" 
              className="hidden" 
              onChange={handleVideoUpload} 
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-500">You can paste a YouTube URL or upload a video file (max 500MB).</p>
        </div>
      )}

      {/* Attachments & Links Section */}
      <div className="border-t border-slate-100 pt-4">
        <label className={labelCls}>Attachments & Links</label>
        
        {attachments.length > 0 && (
          <div className="mb-3 space-y-2">
            {attachments.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-700">
                <span className="truncate max-w-[280px]">
                  {item.type === 'attachment' ? '📎' : '🔗'} {item.name}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                  className="text-red-500 hover:text-red-700 font-bold ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-200">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-700">Option 1: Upload File (PDF, DOCX, TXT)</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isUploadingFile}
                onClick={() => attachmentFileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isUploadingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Choose File & Upload
              </button>
              <input
                type="file"
                ref={attachmentFileInputRef}
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={handleAttachmentUpload}
              />
            </div>
          </div>

          <div className="h-px bg-slate-200 my-1" />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-700">Option 2: Add External Link (e.g. Google Drive)</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Link Name (e.g. Slide PDF)"
                value={newLinkName}
                onChange={(e) => setNewLinkName(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-indigo-600 bg-white"
              />
              <input
                placeholder="URL (https://...)"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-indigo-600 bg-white"
              />
            </div>
            <button
              type="button"
              onClick={handleAddLink}
              className="mt-1 self-start rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
            >
              Add Link
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Lesson Content</label>
        <input type="hidden" name="contentMd" value={contentHtml} />
        <WysiwygEditor 
          value={contentHtml} 
          onChange={setContentHtml} 
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 w-full md:w-auto inline-flex cursor-pointer items-center justify-center rounded-md bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-colors duration-150 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Add Lesson'}
      </button>
    </form>
  )
}
