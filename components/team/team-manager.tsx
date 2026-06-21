"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};
type Invite = { id: string; email: string; role: string; expiresAt: string };

export function TeamManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState<"OWNER" | "MEMBER">("MEMBER");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"OWNER" | "MEMBER">("MEMBER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/team", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
      setInvites(data.invites);
      setRole(data.role);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = role === "OWNER";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: inviteRole }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Failed to invite");
    } else {
      setEmail("");
      await load();
    }
    setBusy(false);
  }

  async function revokeInvite(id: string) {
    setBusy(true);
    await fetch(`/api/team?inviteId=${id}`, { method: "DELETE" });
    await load();
    setBusy(false);
  }

  async function removeMember(id: string) {
    setBusy(true);
    await fetch(`/api/team?userId=${id}`, { method: "DELETE" });
    await load();
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a teammate</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as "OWNER" | "MEMBER")
                  }
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="MEMBER">Member</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Inviting…" : "Send invite"}
              </Button>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded border p-2 text-sm"
            >
              <div>
                <span className="font-medium">{m.name || m.email}</span>{" "}
                <Badge variant="outline">{m.role}</Badge>
                {m.name && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {m.email}
                  </span>
                )}
              </div>
              {isOwner && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => removeMember(m.id)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invites.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between gap-3 rounded border p-2 text-sm"
              >
                <div>
                  <span className="font-medium">{i.email}</span>{" "}
                  <Badge variant="outline">{i.role}</Badge>
                </div>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => revokeInvite(i.id)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
