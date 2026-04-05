import { useEffect, useState } from 'react';
import { HeroNavBar } from '@/components/landing/HeroNavBar';

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-[box-shadow] duration-300 ${
        scrolled ? 'shadow-[0_12px_40px_rgba(0,0,0,0.45)]' : ''
      }`}
    >
      <HeroNavBar variant="solid" />
    </header>
  );
}
