'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { updateLmsLesson, uploadLmsMediaAction } from '@/modules/edu/actions/lms-commercial.actions'
import { BookOpen, FileText, Upload, Loader2 } from 'lucide-react'
import { WysiwygEditor } from '@/app/(lms-internal)/lms/WysiwygEditor'
import { useRouter } from 'next/navigation'

const inputCls = 'w-full rounded-md border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-600 focus:ring-0 hover:border-slate-300'
const labelCls = 'block text-sm font-bold text-slate-900 mb-1.5'

export default function EditLessonForm({ lesson, courseSlug }: { lesson: any, courseSlug: string }) {
  const router = useRouter()
  const [state, action, isPending] = useActionState(updateLmsLesson, {})
  const [lessonType, setLessonType] = useState(lesson.lesson_type || 'TEXT')
  
  // Extract existing video url from media_items if it exists
  const existingVideo = (lesson.media_items || []).find((m: any) => m.type === 'video')
  const defaultVideoUrl = existingVideo ? existingVideo.url : ''
  const [videoUrl, setVideoUrl] = useState(defaultVideoUrl)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [contentHtml, setContentHtml] = useState(lesson.content_md || '')

  useEffect(() => {
    if (state?.success) {
      router.push(`/lms/admin/course/${courseSlug}?tab=curriculum`)
    }
  }, [state, router, courseSlug])

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
        alert(res?.error || 'Gagal mengupload video')
      }
    } catch (err) {
      alert('Gagal mengupload video')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <form action={action} className="grid gap-4">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
          {state.error}
        </div>
      )}

      <input type="hidden" name="lessonId" value={lesson.id} />

      <div>
        <label className={labelCls}>Judul Materi <span className="text-red-400">*</span></label>
        <input name="title" required defaultValue={lesson.title} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Tipe Materi</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'TEXT', label: 'Teks / Artikel',  Icon: FileText },
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
          <label className={labelCls}>URL Video (YouTube / S3) <span className="text-red-400">*</span></label>
          <div className="flex gap-2">
            <input 
              name="videoUrl" 
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required 
              placeholder="Contoh: https://youtube.com/watch?v=..." 
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
          <p className="mt-1 text-[10px] text-slate-500">Anda dapat menempelkan link YouTube atau upload file video (max 500MB).</p>
        </div>
      )}

      <div>
        <label className={labelCls}>Isi Materi</label>
        <input type="hidden" name="contentMd" value={contentHtml} />
        <WysiwygEditor 
          value={contentHtml} 
          onChange={setContentHtml} 
        />
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={() => router.push(`/lms/admin/course/${courseSlug}?tab=curriculum`)}
          className="rounded-md border-2 border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex cursor-pointer items-center justify-center rounded-md bg-indigo-600 px-8 py-2.5 text-sm font-bold text-white transition-colors duration-150 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </form>
  )
}
