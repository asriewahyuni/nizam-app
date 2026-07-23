/**
 * Sanitasi HTML materi dan soal agar script, event handler, serta embed liar
 * tidak pernah dikirim ke browser.
 */
import sanitizeHtml from 'sanitize-html'

const SAFE_IFRAME_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
]

export function sanitizeLearningHtml(value: unknown) {
  return sanitizeHtml(String(value || ''), {
    allowedTags: [
      'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's',
      'blockquote', 'pre', 'code',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'a', 'img', 'figure', 'figcaption',
      'iframe',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      iframe: [
        'src',
        'title',
        'width',
        'height',
        'allow',
        'allowfullscreen',
        'loading',
        'referrerpolicy',
      ],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['https'],
      iframe: ['https'],
    },
    allowedIframeHostnames: SAFE_IFRAME_HOSTS,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: 'a',
        attribs: {
          ...attributes,
          rel: 'noopener noreferrer',
          ...(attributes.target === '_blank' ? { target: '_blank' } : {}),
        },
      }),
      img: (_tagName, attributes) => ({
        tagName: 'img',
        attribs: {
          ...attributes,
          loading: 'lazy',
        },
      }),
      iframe: (_tagName, attributes) => ({
        tagName: 'iframe',
        attribs: {
          ...attributes,
          loading: 'lazy',
          referrerpolicy: 'strict-origin-when-cross-origin',
        },
      }),
    },
  })
}

/**
 * LearnPress lama kadang menyimpan penanda kebenaran di awal judul opsi.
 * Penanda ini tidak boleh sampai terlihat oleh peserta.
 */
export function sanitizeQuizOptionHtml(value: unknown) {
  const withoutCorrectnessMarker = String(value || '').replace(
    /^(\s*(?:<[a-z][^>]*>\s*)*)\[\s*(?:true|correct|benar)\s*\]\s*(?:[-:–—]\s*)?/i,
    '$1',
  )
  return sanitizeLearningHtml(withoutCorrectnessMarker)
}
