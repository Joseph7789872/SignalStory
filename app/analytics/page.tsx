import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          The economics and quality of the pipeline — spend per agent, cache
          reuse, the significance gate, and anti-slop pass rate.
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
