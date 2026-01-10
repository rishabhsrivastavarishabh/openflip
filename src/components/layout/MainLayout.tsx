import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
interface MainLayoutProps {
  children: ReactNode;
}
export function MainLayout({
  children
}: MainLayoutProps) {
  return <div className="min-h-screen bg-background mx-0 py-0 px-0 rounded-none shadow-none">
      <Sidebar />
      <main className="md:ml-[72px] lg:ml-[244px] pb-16 md:pb-64 min-h-screen px-0 border-0 border-none mx-0">
        {children}
      </main>
      <MobileNav />
    </div>;
}