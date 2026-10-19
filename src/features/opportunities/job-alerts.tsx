"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellPlus, BellRing, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { OPPORTUNITY_TYPES, typesForCandidate, TYPE_LABEL, type CandidateType, type OpportunityType } from "@/lib/opportunity-types";
import { PROVINCES } from "@/lib/zimbabwe";

interface Alert {
  id: string;
  label: string;
  keyword: string | null;
  types: OpportunityType[];
  province: string | null;
  paid_only: boolean;
  enabled: boolean;
}

/** Saved searches that notify you the moment a matching opportunity is published. */
export function JobAlerts({ userId, candidateType }: { userId: string; candidateType: CandidateType }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const allowed = React.useMemo(() => OPPORTUNITY_TYPES.filter((t) => typesForCandidate(candidateType).includes(t.value)), [candidateType]);
  const [keyword, setKeyword] = React.useState("");
  const [type, setType] = React.useState("");
  const [province, setProvince] = React.useState("");
  const [paidOnly, setPaidOnly] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["job-alerts", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_alerts").select("id, label, keyword, types, province, paid_only, enabled").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Alert[];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["job-alerts", userId] });

  const create = async () => {
    const label = [keyword.trim(), type ? TYPE_LABEL[type as OpportunityType] : "", province, paidOnly ? "Paid" : ""].filter(Boolean).join(" · ") || "Any new opportunity";
    setSaving(true);
    const { error } = await supabase.from("job_alerts").insert({
      user_id: userId,
      label: label.slice(0, 60),
      keyword: keyword.trim().length >= 2 ? keyword.trim().slice(0, 80) : null,
      types: type ? [type] : [],
      province: province || null,
      paid_only: paidOnly,
    });
    setSaving(false);
    if (error) return void toast.error(error.message.replace(/^.*?:\s*/, ""));
    toast.success("Alert created. We will notify you about new matches.");
    setKeyword("");
    setType("");
    setProvince("");
    setPaidOnly(false);
    void refresh();
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>New alert</CardTitle>
          <CardDescription>Leave everything empty to hear about every new opportunity that fits you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Keyword" htmlFor="alert-kw">
              <Input id="alert-kw" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. accounting, python" maxLength={80} />
            </Field>
            <Field label="Type" htmlFor="alert-type">
              <Select id="alert-type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All types for me</option>
                {allowed.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Province" htmlFor="alert-prov">
              <Select id="alert-prov" value={province} onChange={(e) => setProvince(e.target.value)}>
                <option value="">Anywhere</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} />
            <span className="font-medium">Paid opportunities only</span>
          </label>
          <Button variant="cta" loading={saving} onClick={() => void create()}>
            <BellPlus aria-hidden /> Create alert
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <SkeletonList count={2} />
      ) : alerts.length === 0 ? (
        <EmptyState icon={<BellRing aria-hidden />} title="No alerts yet" description="Create one above and you will be notified about matching opportunities as soon as they open." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.enabled ? "Active" : "Paused"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const { error } = await supabase.from("job_alerts").update({ enabled: !a.enabled }).eq("id", a.id);
                    if (error) toast.error("Could not update the alert");
                    else void refresh();
                  }}
                >
                  {a.enabled ? "Pause" : "Resume"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete alert ${a.label}`}
                  className="text-danger"
                  onClick={async () => {
                    const { error } = await supabase.from("job_alerts").delete().eq("id", a.id);
                    if (error) toast.error("Could not delete the alert");
                    else void refresh();
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
