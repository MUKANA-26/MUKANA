import * as React from "react";

/** Minimal, safe rendering of guide text: "## Heading", "- bullet" lines and paragraphs. Never raw HTML. */
export function ResourceBody({ body }: { body: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="my-3 list-disc space-y-1 pl-6 text-sm leading-6">
          {list.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={`p${blocks.length}`} className="my-3 text-sm leading-6">
          {para.join(" ")}
        </p>,
      );
      para = [];
    }
  };
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushList();
      flushPara();
    } else if (line.startsWith("## ")) {
      flushList();
      flushPara();
      blocks.push(
        <h2 key={`h${blocks.length}`} className="mt-6 font-heading text-lg font-semibold">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("- ")) {
      flushPara();
      list.push(line.slice(2));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushList();
  flushPara();
  return <div>{blocks}</div>;
}
