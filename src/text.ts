const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Strip HTML tags (keeping link text) and decode entities. */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const termCache = new Map<string, RegExp>();

/**
 * Case-insensitive whole-term match: "node" matches "Node.js" but not "nodes",
 * "intern" does not match "internal". Terms may contain punctuation (c#, next.js).
 */
export function containsTerm(haystack: string, term: string): boolean {
  let re = termCache.get(term);
  if (!re) {
    re = new RegExp(`(?<![a-z0-9])${escapeRegExp(term.toLowerCase())}(?![a-z0-9])`, "i");
    termCache.set(term, re);
  }
  return re.test(haystack);
}

export function matchingTerms(haystack: string, terms: string[]): string[] {
  return terms.filter((t) => containsTerm(haystack, t));
}
