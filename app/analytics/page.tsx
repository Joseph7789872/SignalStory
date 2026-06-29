import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="The economics and quality of the pipeline — spend per agent, cache reuse, the significance gate, and anti-slop pass rate."
      />
      <AnalyticsDashboard />
    </div>
  );
}
