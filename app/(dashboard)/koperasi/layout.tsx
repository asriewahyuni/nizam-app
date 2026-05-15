import { KoperasiSubNav } from './KoperasiSubNav'

export default function KoperasiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-0">
      <KoperasiSubNav />
      <div className="mt-6">
        {children}
      </div>
    </div>
  )
}
