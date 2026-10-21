"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquareText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import { ReportButton } from "@/features/opportunities/opportunity-buttons";
import { StarInput, Stars } from "./stars";

export interface RatingSummary {
  count: number;
  avg: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}
export interface MyReview {
  id: string;
  rating: number;
  title: string;
  pros: string | null;
  cons: string | null;
  advice: string | null;
  relationship: string;
  anonymous: boolean;
}
interface ReviewRow {
  id: string;
  rating: number;
  title: string;
  pros: string | null;
  cons: string | null;
  advice: string | null;
  relationship: string;
  author_name: string | null;
  employer_reply: string | null;
  reply_at: string | null;
  created_at: string;
  mine: boolean;
}

const REL: Record<string, string> = { attachee: "Attachee", graduate_trainee: "Graduate trainee", intern: "Intern", employee: "Employee", applicant: "Applicant" };
const clean = (m: string) => m.replace(/^.*?:\s*/, "");

/** Ratings and reviews. Only people who have been through the company's process can write one; employers can reply; anyone can report. */
export function ReviewsSection({
  companyId,
  summary,
  signedIn,
  role,
  canReview,
  myReview,
  isOwner,
}: {
  companyId: string;
  summary: RatingSummary;
  signedIn: boolean;
  role: "candidate" | "employer" | "admin" | null;
  canReview: boolean;
  myReview: MyReview | null;
  isOwner: boolean;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [writing, setWriting] = React.useState(false);
  const [replying, setReplying] = React.useState<ReviewRow | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [form, setForm] = React.useState({
    rating: myReview?.rating ?? 0,
    title: myReview?.title ?? "",
    pros: myReview?.pros ?? "",
    cons: myReview?.cons ?? "",
    advice: myReview?.advice ?? "",
    relationship: myReview?.relationship ?? "attachee",
    anonymous: myReview?.anonymous ?? true,
  });
  const [pending, setPending] = React.useState(false);

  const reviews = useQuery({
    queryKey: ["company-reviews", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("company_reviews_list", { p_company: companyId, p_limit: 30, p_offset: 0 });
      if (error) throw error;
      return (data ?? []) as ReviewRow[];
    },
    staleTime: 30_000,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["company-reviews", companyId] });
    router.refresh();
  };

  const submit = async () => {
    setPending(true);
    const { error } = await supabase.rpc("write_company_review", {
      p_company: companyId,
      p_rating: form.rating,
      p_title: form.title,
      p_pros: form.pros,
      p_cons: form.cons,
      p_advice: form.advice,
      p_relationship: form.relationship,
      p_anonymous: form.anonymous,
    });
    setPending(false);
    if (error) return void toast.error(clean(error.message));
    toast.success("Thank you. Your review is published.");
    setWriting(false);
    refresh();
  };
  const sendReply = async () => {
    if (!replying) return;
    const { error } = await supabase.rpc("reply_to_review", { p_review: replying.id, p_reply: replyText });
    if (error) return void toast.error(clean(error.message));
    toast.success("Reply saved");
    setReplying(null);
    refresh();
  };

  const total = summary.count;
  return (
    <section aria-labelledby="reviews-h" className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="reviews-h" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <MessageSquareText className="size-5 text-link" aria-hidden /> Reviews from attachees and graduates
        </h2>
        {canReview ? (
          <Button variant="cta" size="sm" onClick={() => setWriting(true)}>
            {myReview ? "Edit my review" : "Write a review"}
          </Button>
        ) : null}
      </div>

      {total > 0 ? (
        <div className="mt-4 grid items-center gap-4 sm:grid-cols-[auto_1fr]">
          <div className="text-center">
            <p className="font-heading text-4xl font-bold">{Number(summary.avg).toFixed(1)}</p>
            <Stars value={Number(summary.avg)} size="size-5" />
            <p className="mt-1 text-xs text-muted-foreground">
              {total} review{total === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="space-y-1.5">
            {([5, 4, 3, 2, 1] as const).map((n) => (
              <li key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right">{n}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span className="block h-full bg-cta" style={{ width: `${total ? (summary.distribution[String(n) as "1"] / total) * 100 : 0}%` }} />
                </span>
                <span className="w-6 text-muted-foreground">{summary.distribution[String(n) as "1"]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No reviews yet.</p>
      )}

      <p className="mt-3 flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-xs text-info-soft-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        Only people who received an offer, were placed or completed an interview with this company can review it. Reviews are moderated.
      </p>

      <ul className="mt-4 space-y-4">
        {(reviews.data ?? []).map((r) => (
          <li key={r.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={r.rating} />
              <h3 className="font-semibold">{r.title}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.author_name ?? "Anonymous"} · <Badge variant="neutral">{REL[r.relationship] ?? r.relationship}</Badge> · {timeAgo(r.created_at)}
              {r.mine ? " · your review" : ""}
            </p>
            <div className="mt-3 space-y-2 text-sm leading-6">
              {r.pros ? (
                <p>
                  <strong className="text-success">Good: </strong>
                  {r.pros}
                </p>
              ) : null}
              {r.cons ? (
                <p>
                  <strong className="text-danger">Could be better: </strong>
                  {r.cons}
                </p>
              ) : null}
              {r.advice ? (
                <p>
                  <strong>Advice: </strong>
                  {r.advice}
                </p>
              ) : null}
            </div>
            {r.employer_reply ? (
              <div className="mt-3 rounded-lg bg-surface-muted p-3 text-sm">
                <p className="text-xs font-semibold text-muted-foreground">Reply from the company</p>
                <p className="mt-1">{r.employer_reply}</p>
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isOwner ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReplying(r);
                    setReplyText(r.employer_reply ?? "");
                  }}
                >
                  {r.employer_reply ? "Edit reply" : "Reply"}
                </Button>
              ) : null}
              {signedIn && !r.mine && role !== "admin" && !isOwner ? <ReportButton targetType="review" targetId={r.id} label="Report" /> : null}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={writing} onClose={() => setWriting(false)} title={myReview ? "Edit your review" : "Review this company"} description="Be fair and specific. Do not share private details about people." className="max-w-lg">
        <div className="space-y-3">
          <Field label="Your rating" htmlFor="rv-rating" required>
            <StarInput id="rv-rating" value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} />
          </Field>
          <Field label="Headline" htmlFor="rv-title" required>
            <Input id="rv-title" maxLength={100} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Patient supervisors and real work" />
          </Field>
          <Field label="What was good?" htmlFor="rv-pros">
            <Textarea id="rv-pros" rows={2} maxLength={1000} value={form.pros} onChange={(e) => setForm((f) => ({ ...f, pros: e.target.value }))} />
          </Field>
          <Field label="What could be better?" htmlFor="rv-cons">
            <Textarea id="rv-cons" rows={2} maxLength={1000} value={form.cons} onChange={(e) => setForm((f) => ({ ...f, cons: e.target.value }))} />
          </Field>
          <Field label="Advice for others" htmlFor="rv-advice">
            <Textarea id="rv-advice" rows={2} maxLength={1000} value={form.advice} onChange={(e) => setForm((f) => ({ ...f, advice: e.target.value }))} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your experience" htmlFor="rv-rel">
              <Select id="rv-rel" value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}>
                {Object.entries(REL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input type="checkbox" className="size-4" checked={form.anonymous} onChange={(e) => setForm((f) => ({ ...f, anonymous: e.target.checked }))} />
              Post anonymously
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setWriting(false)}>
              Cancel
            </Button>
            <Button variant="cta" loading={pending} disabled={form.rating < 1 || form.title.trim().length < 3} onClick={() => void submit()}>
              Publish review
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={replying !== null} onClose={() => setReplying(null)} title="Reply to this review" description="Replies are public. Stay professional and thank the reviewer." className="max-w-lg">
        <div className="space-y-3">
          <Textarea aria-label="Your reply" rows={4} maxLength={1000} value={replyText} onChange={(e) => setReplyText(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReplying(null)}>
              Cancel
            </Button>
            <Button variant="cta" onClick={() => void sendReply()}>
              Save reply
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
