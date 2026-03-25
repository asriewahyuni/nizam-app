import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'NIZAM ERP — Professional Cloud OS', template: '%s | NIZAM ERP' },
  description: 'Sistem ERP Pintar untuk Efisiensi Bisnis Maksimal.',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  themeColor: '#003366',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-[#F8F9FA] text-[#212529]`}>
        {children}
      </body>
    </html>
  )
}
