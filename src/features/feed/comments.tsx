"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SendHorizontal, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import { addCommentAction, deleteCommentAction } from "./actions";
import { MentionTextarea } from "./mention-textarea";
import { withTokens } from "./mentions";
import { PostBody } from "./post-body";
import { fetchComments } from "./queries";

export function Comments({ postId, postAuthorId, userId, myName, myAvatar }: { postId: string; postAuthorId: string; userId: string; myName: string; myAvatar: string | null }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [text, setText] = React.useState("");
  const [mentions, setMentions] = React.useState<Record<string, string>>({});

  const { data: comments = [], isLoading } = useQuery({ queryKey: ["feed", "comments", postId], queryFn: () => fetchComments(supabase, postId) });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["feed", "comments", postId] });
    void queryClient.invalidateQueries({ queryKey: ["feed", "posts"] });
  };

  const send = useMutation({
    mutationFn: async () => {
      const r = await addCommentAction(postId, withTokens(text.trim(), mentions));
      if (!r.ok) throw new Error(r.error ?? "Could not comment");
    },
    onSuccess: () => {
      setText("");
      setMentions({});
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await deleteCommentAction(id);
      if (!r.ok) throw new Error(r.error ?? "Could not delete");
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {isLoading ? <p className="text-sm text-muted-foreground">Loading comments…</p> : null}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Avatar url={c.avatarUrl} name={c.author?.full_name} size="sm" />
            <div className="min-w-0 flex-1 rounded-2xl bg-surface-muted px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="text-sm font-semibold">
                  {c.author ? (
                    <Link href={`/people/${c.author.id}`} className="hover:underline">
                      {c.author.full_name}
                    </Link>
                  ) : (
                    "Member"
                  )}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{timeAgo(c.created_at)}</span>
                </p>
                {c.author_id === userId || postAuthorId === userId ? (
                  <button type="button" onClick={() => remove.mutate(c.id)} aria-label="Delete comment" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-danger">
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
              <PostBody body={c.body} className="whitespace-pre-line break-words text-sm leading-5" />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-start gap-2.5">
        <Avatar url={myAvatar} name={myName} size="sm" />
        <div className="min-w-0 flex-1">
          <MentionTextarea
            aria-label="Write a comment"
            value={text}
            onChange={setText}
            mentions={mentions}
            onMention={(n, id) => setMentions((m) => ({ ...m, [n]: id }))}
            placeholder="Add a comment… (type @ to tag)"
            rows={1}
            maxLength={1000}
            onSubmitShortcut={() => text.trim() && send.mutate()}
          />
        </div>
        <Button type="button" size="icon" variant="cta" aria-label="Send comment" disabled={!text.trim() || send.isPending} loading={send.isPending} onClick={() => send.mutate()}>
          <SendHorizontal aria-hidden />
        </Button>
      </div>
    </div>
  );
}
