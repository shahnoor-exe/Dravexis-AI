import React, { useRef, useEffect } from 'react';
import { useThemeStore } from '../store/themeStore';
import gsap from 'gsap';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const iconRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Optional micro-animation on theme mount/change
    if (iconRef.current) {
      gsap.fromTo(
        iconRef.current,
        { rotation: -90, opacity: 0.5 },
        { rotation: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' }
      );
    }
    
    // Smooth GSAP color transition for the background
    gsap.to(['body', '#root'], {
      backgroundColor: theme === 'dark' ? '#070A0F' : '#F3F5F9',
      color: theme === 'dark' ? '#f4f4f5' : '#0F172A',
      duration: 0.4,
      ease: 'power2.out'
    });
  }, [theme]);

  return (
    <button
      onClick={toggleTheme}
      className={`relative flex items-center justify-center w-8 h-8 rounded-md border transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-zinc-900 border-zinc-800 text-neon-cyan hover:bg-zinc-800 glow-cyan' 
          : 'bg-white border-slate-300 text-neon-cyan hover:bg-slate-100 shadow-sm'
      }`}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
    >
      {theme === 'dark' ? (
        <svg ref={iconRef} className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg ref={iconRef} className="w-4 h-4 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
};
