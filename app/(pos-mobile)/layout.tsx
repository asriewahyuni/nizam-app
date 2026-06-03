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
    <div className={`${inter.className} min-h-screen bg-[#F8FAFC] text-[#1E293B] flex flex-col overscroll-none`}>
      {children}
    </div>
  );
}
