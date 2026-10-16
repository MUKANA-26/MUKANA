/**
 * Tags are stored in the text as  @[Full Name](user-uuid)  and shown as links.
 * In the editor people type @Name; the picker remembers who was chosen and the tokens are written on send.
 */
export const MENTION_RE = /@\[([^\]]{1,80})\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g;

export type Segment = { type: "text"; text: string } | { type: "mention"; name: string; id: string } | { type: "link"; url: string };

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g;

/** Splits stored text into plain text, tagged people and links, ready to render safely as React nodes. */
export function parseBody(body: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  const pushText = (text: string) => {
    let i = 0;
    for (const m of text.matchAll(URL_RE)) {
      if (m.index! > i) out.push({ type: "text", text: text.slice(i, m.index) });
      out.push({ type: "link", url: m[0] });
      i = m.index! + m[0].length;
    }
    if (i < text.length) out.push({ type: "text", text: text.slice(i) });
  };
  for (const m of body.matchAll(MENTION_RE)) {
    if (m.index! > last) pushText(body.slice(last, m.index));
    out.push({ type: "mention", name: m[1]!, id: m[2]! });
    last = m.index! + m[0].length;
  }
  if (last < body.length) pushText(body.slice(last));
  return out;
}

/** Replaces the @Name text of people chosen in the picker with stored tokens. */
export function withTokens(text: string, chosen: Record<string, string>): string {
  let out = text;
  // Longest names first so "@Ana Maria" wins over "@Ana".
  for (const [name, id] of Object.entries(chosen).sort((a, b) => b[0].length - a[0].length)) {
    const safe = name.replace(/[\[\]()]/g, "");
    out = out.split(`@${name}`).join(`@[${safe}](${id})`);
  }
  return out;
}

/** Plain-text preview (for notifications and share text). */
export function plainText(body: string): string {
  return body.replace(MENTION_RE, "@$1");
}