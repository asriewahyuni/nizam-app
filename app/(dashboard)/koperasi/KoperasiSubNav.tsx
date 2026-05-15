'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Users, Wallet, BadgePercent, UserCog,
  ShieldCheck, FileText, ShoppingCart, BookOpen, BarChart3, Landmark,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', href: '/koperasi', icon: LayoutDashboard },
  { label: 'Anggota', href: '/koperasi/anggota', icon: Users },
  { label: 'Simpanan', href: '/koperasi/simpanan', icon: Wallet },
  { label: 'Shahibul Maal', href: '/koperasi/shahibul-maal', icon: BadgePercent },
  { label: 'Mudharib', href: '/koperasi/mudharib', icon: UserCog },
  { label: 'Sertifikasi DPS', href: '/koperasi/sertifikasi', icon: ShieldCheck },
  { label: 'Pengurus', href: '/koperasi/pengurus', icon: Landmark },
  { label: 'Akad Wakalah', href: '/koperasi/akad-wakalah', icon: FileText },
  { label: 'Murabahah', href: '/koperasi/murabahah', icon: ShoppingCart },
  { label: 'Proyek', href: '/koperasi/proyek', icon: BookOpen },
  { label: 'Laporan', href: '/koperasi/laporan', icon: BarChart3 },
]

export function KoperasiSubNav() {
  const pathname = usePathname()

  // Sembunyikan navigasi kalo lagi di halaman onboarding
  if (pathname?.startsWith('/koperasi/onboarding')) {
    return null
  }

  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
      {navItems.map(item => {
        const isActive = item.href === '/koperasi'
          ? pathname === '/koperasi'
          : pathname?.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all shrink-0 ${
              isActive
                ? 'bg-[#003366] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
