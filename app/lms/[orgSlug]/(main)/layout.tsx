import React from 'react'
import Link from 'next/link'
import { BookOpen, UserCircle } from 'lucide-react'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'

export const metadata = {
  title: 'LMS Portal',
  description: 'Learning Management System',
}

export default async function LMSLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getInternalAuthSession()
  const isLoggedIn = !!session?.user

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 antialiased flex flex-col">
      <div className="mx-auto flex min-h-screen max-w-[480px] w-full flex-col border-x border-slate-200/80 bg-[#f7fbf9] shadow-2xl">
        <header className="sticky top-0 z-50 border-b border-emerald-950/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex min-h-16 items-center gap-3 px-4 justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-emerald-700 rounded-xl flex items-center justify-center text-white shadow-sm">
                <BookOpen size={19} />
              </div>
              <div>
                <Link href={`/lms/${orgSlug}`} className="text-sm font-bold text-slate-900 tracking-tight hover:text-indigo-600 transition-colors">
                  LMS Portal
                </Link>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">{orgSlug}</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              {isLoggedIn ? (
                <>
                  <Link href={`/lms/${orgSlug}/my-progress`} className="text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors">
                    Kelas Saya
                  </Link>
                  <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                    <span className="text-xs font-semibold text-slate-700 max-w-24 truncate">
                      {String(session?.user?.user_metadata.full_name || session?.user?.email || 'Member')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <Link 
                    href={`/login?callbackUrl=/lms/${orgSlug}`}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Masuk
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        
        <main className="flex-1 w-full">
          {children}
        </main>
        
        <footer className="border-t border-emerald-950/10 bg-emerald-950 text-emerald-50 py-6 mt-auto">
          <div className="px-4 text-center">
            <p className="text-[10px] text-emerald-100/75 font-medium">Powered by NIZAM ERP</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
