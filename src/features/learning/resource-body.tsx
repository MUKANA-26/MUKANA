import * as React from "react";

/** **bold** inside a line, as safe React nodes. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>))}
    </>
  );
}

/** Minimal, safe rendering of guide text: "## Heading", "- bullet", "1. numbered", "Tip: call-out", **bold** and paragraphs. Never raw HTML. */
export function ResourceBody({ body }: { body: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];
  let para: string[] = [];
  const flushLists = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="my-3 list-disc space-y-1 pl-6 text-sm leading-6">
          {bullets.map((t, i) => (
            <li key={i}>
              <Inline text={t} />
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    }
    if (numbers.length) {
      blocks.push(
        <ol key={`o${blocks.length}`} className="my-3 list-decimal space-y-1 pl-6 text-sm leading-6">
          {numbers.map((t, i) => (
            <li key={i}>
              <Inline text={t} />
            </li>
          ))}
        </ol>,
      );
      numbers = [];
    }
  };
  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={`p${blocks.length}`} className="my-3 text-sm leading-6">
          <Inline text={para.join(" ")} />
        </p>,
      );
      para = [];
    }
  };
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushLists();
      flushPara();
    } else if (line.startsWith("## ")) {
      flushLists();
      flushPara();
      blocks.push(
        <h2 key={`h${blocks.length}`} className="mt-6 font-heading text-lg font-semibold">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("- ")) {
      flushPara();
      if (numbers.length) flushLists();
      bullets.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      flushPara();
      if (bullets.length) flushLists();
      numbers.push(line.replace(/^\d+\.\s/, ""));
    } else if (line.startsWith("Tip:")) {
      flushLists();
      flushPara();
      blocks.push(
        <p key={`t${blocks.length}`} className="my-4 rounded-lg border-l-4 border-cta bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-soft-foreground">
          <strong>Tip: </strong>
          <Inline text={line.slice(4).trim()} />
        </p>,
      );
    } else {
      flushLists();
      para.push(line);
    }
  }
  flushLists();
  flushPara();
  return <div>{blocks}</div>;
}
