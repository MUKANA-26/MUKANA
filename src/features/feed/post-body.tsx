import Link from "next/link";
import { parseBody } from "./mentions";

/** Renders post/comment text: tagged people become links, URLs become safe external links. Never raw HTML. */
export function PostBody({ body, className }: { body: string; className?: string }) {
  return (
    <p className={className ?? "whitespace-pre-line break-words text-sm leading-6"}>
      {parseBody(body).map((s, i) =>
        s.type === "text" ? (
          <span key={i}>{s.text}</span>
        ) : s.type === "mention" ? (
          <Link key={i} href={`/people/${s.id}`} className="font-semibold text-link hover:underline">
            @{s.name}
          </Link>
        ) : (
          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all text-link underline">
            {s.url}
          </a>
        ),
      )}
    </p>
  );
}
