import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'POS Kargo - Nizam App',
  description: 'Point of Sales Khusus Loket Kargo Nizam ERP',
};

export default function PosCargoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.className} min-h-screen bg-slate-50 text-[#1E293B] flex flex-col w-full h-[100dvh] overflow-y-auto`}>
      {children}
    </div>
  );
}
