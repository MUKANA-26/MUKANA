"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, Pencil, Trash2, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { closeOpportunityAction, deleteDraftAction } from "./actions";

export function EmployerOpportunityActions({
  id,
  status,
  applicantCount,
}: {
  id: string;
  status: "draft" | "published" | "closed";
  applicantCount: number;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState<null | "close" | "delete">(null);
  const [pending, startTransition] = React.useTransition();

  const run = () =>
    startTransition(async () => {
      const r = confirm === "delete" ? await deleteDraftAction(id) : await closeOpportunityAction(id);
      if (r.ok) {
        toast.success(r.message ?? "Done");
        setConfirm(null);
        router.refresh();
      } else toast.error(r.error ?? "Something went wrong");
    });

  const copy = async () => {
    const url = `${window.location.origin}/opportunities/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied. Paste it into WhatsApp to share.");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/employer/opportunities/${id}/edit`}>
            <Pencil aria-hidden /> Edit
          </Link>
        </Button>
        {status !== "draft" ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/employer/applicants?opportunity=${id}`}>
              <Users aria-hidden /> Applicants ({applicantCount})
            </Link>
          </Button>
        ) : null}
        {status === "published" ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => void copy()}>
              <Copy aria-hidden /> Copy link
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/opportunities/${id}`} target="_blank">
                <ExternalLink aria-hidden /> View
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm("close")}>
              <XCircle aria-hidden /> Close
            </Button>
          </>
        ) : null}
        {status === "draft" ? (
          <Button size="sm" variant="ghost" onClick={() => setConfirm("delete")}>
            <Trash2 aria-hidden /> Delete
          </Button>
        ) : null}
      </div>
      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "delete" ? "Delete this draft?" : "Close this opportunity?"}
        description={
          confirm === "delete"
            ? "This permanently removes the draft."
            : "Candidates will no longer be able to apply. Existing applications stay available."
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button variant={confirm === "delete" ? "destructive" : "default"} loading={pending} onClick={run}>
            {confirm === "delete" ? "Delete draft" : "Close opportunity"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
