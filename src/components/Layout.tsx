import React from 'react';
import { motion } from 'motion/react';
import { Home, Calendar, Users, Settings as SettingsIcon, Flame } from 'lucide-react';
import { BirdLogo } from './Branding';
import CraveButton from './CraveButton';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'plan', icon: Calendar, label: 'Plan' },
    { id: 'crave', icon: Flame, label: 'Crave' },
    { id: 'community', icon: Users, label: 'Social' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none h-full w-full bg-background">
      {/* Notch spacer */}
      <div className="h-[34px] flex-shrink-0" />
      
      {/* Status Bar */}
      <div className="h-[44px] px-[30px] flex-shrink-0 flex justify-between items-center text-[11px] font-bold z-40 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-charcoal/40">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-1.5 text-charcoal/40">
          <span className="text-[10px]">📶</span>
          <span className="text-[10px]">🔋</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-[90px] bg-white/95 backdrop-blur-2xl border-t border-gray-100 flex-shrink-0 pb-safe px-6 flex justify-between items-center z-40 relative">
        {tabs.map((tab) => {
          if (tab.id === 'crave') {
            return (
              <div key={tab.id} className="relative -top-6">
                <CraveButton />
              </div>
            );
          }
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1.5 transition-all flex-1 py-1 relative ${
                isActive ? 'text-sage scale-105' : 'text-gray-300 hover:text-gray-400'
              }`}
            >
              <tab.icon size={24} strokeWidth={isActive ? 3 : 2} />
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] transition-all ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                {tab.label}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="nav-glow"
                  className="absolute -bottom-2 w-1 h-1 bg-sage rounded-full shadow-[0_0_10px_#7DB87A]"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

