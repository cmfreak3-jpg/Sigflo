import { LandingAmbientWaveforms } from '@/components/landing/effects/LandingAmbientWaveforms';
import { LandingAtmosphereGrid } from '@/components/landing/effects/LandingAtmosphereGrid';
import { LandingDiagonalStreams } from '@/components/landing/effects/LandingDiagonalStreams';
import { LandingFloatingPixels } from '@/components/landing/effects/LandingFloatingPixels';
import { LandingGeometricFrames } from '@/components/landing/effects/LandingGeometricFrames';
import { LandingScanSweeps } from '@/components/landing/effects/LandingScanSweeps';
import { LandingSignalRipplesField } from '@/components/landing/effects/LandingSignalRipplesField';

/**
 * Global “living system” layer: chart grid, ghost frames, diagonal streams,
 * dense motes, multi-zone ripples, multi-axis scans. Fixed under content.
 */
export function LandingPageAtmosphere() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <LandingAtmosphereGrid />
      <LandingGeometricFrames />
      <LandingDiagonalStreams />
      <LandingSignalRipplesField />
      <LandingScanSweeps />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-8%,rgba(0,200,120,0.038),transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_80%_90%,rgba(0,200,120,0.022),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_10%_60%,rgba(0,224,138,0.018),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_42%_at_92%_12%,rgba(157,0,255,0.022),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_38%_at_6%_88%,rgba(0,232,255,0.018),transparent_52%)]" />
      {/* Above gradient washes so motes aren’t fully buried; still behind page content (main z-[1]). */}
      <LandingFloatingPixels />
      <LandingAmbientWaveforms />
    </div>
  );
}
