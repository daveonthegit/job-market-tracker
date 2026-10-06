export type SourceName = "greenhouse" | "lever" | "remotive" | "arbeitnow" | "hn";

/** One normalized job posting, as stored in data/YYYY/MM/YYYY-MM-DD.json. */
export interface Posting {
  /** Stable id: `<source>:<id within that source>`. */
  id: string;
  source: SourceName;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  /** ISO-8601 timestamp from the source, or null when the source gives none. */
  postedAt: string | null;
  /** Free-form tags from the source (lowercased); used for skill counts. */
  tags: string[];
}

export interface SourceReport {
  source: SourceName;
  /** Postings returned by the source before filtering. */
  fetched: number;
  /** Postings that matched the search criteria. */
  matched: number;
  /** Matched postings that survived dedupe and were recorded as new today. */
  new: number;
}

export interface Snapshot {
  date: string;
  generatedAt: string;
  sources: SourceReport[];
  postings: Posting[];
}

export interface Criteria {
  /** Postings whose source date is older than this many days are ignored. */
  maxAgeDays: number;
  keywords: string[];
  excludeKeywords: string[];
  locations: string[];
  remoteRegions: string[];
  skills: string[];
  sources: {
    remotive: { enabled: boolean; category: string };
    arbeitnow: { enabled: boolean; maxPages: number };
    hn: { enabled: boolean };
    greenhouse: { enabled: boolean; boards: string[] };
    lever: { enabled: boolean; boards: string[] };
  };
}
