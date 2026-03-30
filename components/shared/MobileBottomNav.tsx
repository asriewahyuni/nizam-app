'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Store, 
  FileText, 
  History, 
  User 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function MobileBottomNav() {
  const pathname = usePathname()

  const items = [
    { label: 'Dash', href: '/dashboard', icon: LayoutDashboard },
    { label: 'POS', href: '/pos', icon: Store },
    { label: 'Laporan', href: '/reports', icon: FileText },
    { label: 'Audit', href: '/audit', icon: History },
    { label: 'Akun', href: '/profile', icon: User },
  ]

  return (
    <nav className="print:hidden md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex items-center justify-around pb-safe pt-2 px-2">
      {items.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
              isActive ? "text-[#003366]" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl",
              isActive ? "bg-blue-50" : "bg-transparent"
            )}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tight">
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
