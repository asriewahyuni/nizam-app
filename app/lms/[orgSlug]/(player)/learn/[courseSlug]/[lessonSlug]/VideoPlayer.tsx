'use client'

import React from 'react'

export default function VideoPlayer({ url }: { url: string }) {
  // Simple heuristic for youtube
  const isYoutube = url.includes('youtube.com') || url.includes('youtu.be')

  if (isYoutube) {
    let embedUrl = url
    if (url.includes('watch?v=')) {
      const v = new URL(url).searchParams.get('v')
      if (v) embedUrl = `https://www.youtube.com/embed/${v}`
    } else if (url.includes('youtu.be/')) {
      const v = url.split('youtu.be/')[1]?.split('?')[0]
      if (v) embedUrl = `https://www.youtube.com/embed/${v}`
    }

    return (
      <iframe
        className="w-full h-full"
        src={embedUrl}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    )
  }

  // Fallback to HTML5 video (for S3 or direct MP4 links)
  return (
    <video
      className="w-full h-full max-h-[70vh] object-contain"
      controls
      controlsList="nodownload"
      preload="metadata"
    >
      <source src={url} type="video/mp4" />
      Browser Anda tidak mendukung elemen video HTML5.
    </video>
  )
}
