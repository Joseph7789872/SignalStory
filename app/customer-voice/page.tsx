import { CustomerVoiceManager } from "@/components/context/customer-voice-manager";

export const dynamic = "force-dynamic";

export default function CustomerVoicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customer voice</h1>
        <p className="text-sm text-muted-foreground">
          Real customer language — objections, praise, the exact words they use.
          Every agent reasons against these, so the writing borrows your
          customers&apos; phrasing instead of generic filler.
        </p>
      </div>
      <CustomerVoiceManager />
    </div>
  );
}
