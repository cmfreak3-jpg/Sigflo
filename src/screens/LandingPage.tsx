import { LandingAppScreens } from '@/components/landing/LandingAppScreens';
import { LandingBackground } from '@/components/landing/LandingBackground';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingFinalCta } from '@/components/landing/LandingFinalCta';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks';
import { LandingSectionDivider } from '@/components/landing/LandingSectionDivider';
import { LandingTrust } from '@/components/landing/LandingTrust';
import { LandingWhyExists } from '@/components/landing/LandingWhyExists';

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-landing-bg text-landing-text antialiased">
      <LandingBackground />
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingSectionDivider />
        <LandingWhyExists />
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
      <LandingFooter />
    </div>
  );
}
