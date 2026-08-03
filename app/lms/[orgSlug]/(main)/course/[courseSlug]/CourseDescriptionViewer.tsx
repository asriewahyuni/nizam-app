'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function CourseDescriptionViewer({ description }: { description?: string | null }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!description) {
    return (
      <p className="text-xs text-slate-600 leading-relaxed mb-6">
        Tidak ada deskripsi kursus.
      </p>
    )
  }

  const isLong = description.length > 350

  return (
    <div className="mb-6">
      <div
        className={`prose prose-slate max-w-none text-xs sm:text-sm text-slate-600 leading-relaxed prose-img:rounded-xl prose-img:max-h-[400px] prose-img:object-cover prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-headings:text-slate-900 prose-p:my-2 relative transition-all duration-300 ${
          !isExpanded && isLong ? 'max-h-48 overflow-hidden' : ''
        }`}
      >
        <div dangerouslySetInnerHTML={{ __html: description }} />
        {!isExpanded && isLong && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
        )}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors focus:outline-none"
        >
          {isExpanded ? (
            <>
              <span>Sembunyikan deskripsi</span>
              <ChevronUp size={14} />
            </>
          ) : (
            <>
              <span>Baca selengkapnya</span>
              <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </div>
  )
}
