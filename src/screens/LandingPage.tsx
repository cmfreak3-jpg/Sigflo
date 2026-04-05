import { useEffect, useState } from 'react';
import { LandingAppScreens } from '@/components/landing/LandingAppScreens';
import { LandingBackground } from '@/components/landing/LandingBackground';
import { LandingPageAtmosphere } from '@/components/landing/LandingPageAtmosphere';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingFinalCta } from '@/components/landing/LandingFinalCta';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks';
import { LandingInsideSignal } from '@/components/landing/LandingInsideSignal';
import { LandingSectionDivider } from '@/components/landing/LandingSectionDivider';
import { LandingTransformation } from '@/components/landing/LandingTransformation';
import { LandingTrust } from '@/components/landing/LandingTrust';

export default function LandingPage() {
  const [heroInView, setHeroInView] = useState(true);

  useEffect(() => {
    const top = document.getElementById('top');
    if (!top) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setHeroInView(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '0px' },
    );
    io.observe(top);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative min-h-[100dvh] bg-landing-bg text-landing-text antialiased">
      <LandingBackground />
      <LandingPageAtmosphere />
      {!heroInView ? <LandingHeader /> : null}
      <main className="relative z-[1]">
        <HeroSection embedNav={heroInView} />
        <LandingSectionDivider />
        <LandingInsideSignal />
        <LandingSectionDivider />
        <LandingTransformation />
        <LandingSectionDivider />
        <LandingHowItWorks />
        <LandingSectionDivider />
        <LandingFeatures />
        <LandingSectionDivider />
        <LandingAppScreens />
        <LandingSectionDivider />
        <LandingTrust />
        <LandingSectionDivider />
        <LandingFaq />
        <LandingFinalCta />
      </main>
      <div className="relative z-[1]">
        <LandingFooter />
      </div>
    </div>
  );
}
