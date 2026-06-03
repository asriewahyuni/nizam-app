import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'POS Mobile - Nizam App',
  description: 'Mobile Point of Sales for Nizam ERP Canvassing',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'POS Mobile',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function PosMobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.className} min-h-screen bg-[#F8FAFC] md:bg-slate-900 text-[#1E293B] flex flex-col items-center justify-center overscroll-none`}>
      <div className="w-full h-[100dvh] flex flex-col md:max-w-[414px] md:h-[896px] md:max-h-[95vh] md:rounded-[3rem] md:border-[12px] md:border-slate-800 md:shadow-2xl md:overflow-hidden bg-white relative">
        {/* Notch Simulation for Desktop */}
        <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-slate-800 rounded-b-3xl z-50"></div>
        {children}
      </div>
    </div>
  );
}
