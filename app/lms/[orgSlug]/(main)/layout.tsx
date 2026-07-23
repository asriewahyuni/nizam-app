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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                <BookOpen size={20} />
              </div>
              <div>
                <Link href={`/lms/${orgSlug}`} className="text-lg font-bold text-slate-900 tracking-tight hover:text-indigo-600 transition-colors">
                  LMS Portal
                </Link>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">{orgSlug}</p>
              </div>
            </div>
            <nav className="flex items-center gap-6">
              {isLoggedIn ? (
                <>
                  <Link href={`/lms/${orgSlug}/my-progress`} className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">
                    Kelas Saya
                  </Link>
                  <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
                    <UserCircle className="text-slate-400" size={24} />
                    <span className="text-sm font-semibold text-slate-700 hidden sm:inline-block">
                      {String(session?.user?.user_metadata.full_name || session?.user?.email || 'Member')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <Link 
                    href={`/login?callbackUrl=/lms/${orgSlug}`}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Masuk
                  </Link>
                  <Link 
                    href={`/login?callbackUrl=/lms/${orgSlug}`}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm hidden sm:block"
                  >
                    Daftar Akun
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full">
        {children}
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-slate-400 font-medium">Powered by NIZAM ERP</p>
        </div>
      </footer>
    </div>
  )
}
