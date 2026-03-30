import { Card } from '@/components/ui/Card';

export function PlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-sm text-sigflo-muted">{subtitle}</p>
      </header>
      <Card className="p-6 text-center">
        <p className="text-sm text-sigflo-muted">Coming soon — layout shell only.</p>
      </Card>
    </div>
  );
}
