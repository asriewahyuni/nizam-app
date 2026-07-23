import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#003366',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: { default: 'NIZAM ERP — Professional Cloud OS', template: '%s | NIZAM ERP' },
  description: 'Sistem ERP Pintar untuk Efisiensi Bisnis Maksimal.',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

import { Plus_Jakarta_Sans } from 'next/font/google'

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth" suppressHydrationWarning className={jakartaSans.variable}>
      <body className="font-sans antialiased bg-[#F8F9FA] text-[#212529]">
        {children}
      </body>
    </html>
  )
}
