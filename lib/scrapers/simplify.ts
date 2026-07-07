import { fetchJson, matchesTitleFilter, withRetry } from './_http';
import type { RawJob } from './greenhouse';

// SimplifyJobs/New-Grad-Positions: community-curated new-grad listings with
// a machine-readable feed. ~2,000 active entries, no descriptions (the URL
// is usually a direct ATS link). Every listing is entry-level by curation.
const FEED_URL =
  'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json';

const CATEGORIES = new Set(['Software', 'AI/ML/Data', 'Quant']);

interface SimplifyListing {
  id: string;
  company_name: string;
  title: string;
  url: string;
  locations: string[];
  active: boolean;
  date_posted: number; // unix seconds
  date_updated: number;
  category?: string;
  sponsorship?: string; // "Offers Sponsorship" | "Does Not Offer Sponsorship" | "U.S. Citizenship is Required" | "Other"
}

export async function scrapeSimplify(): Promise<RawJob[]> {
  const listings = await withRetry(() => fetchJson<SimplifyListing[]>(FEED_URL, { timeoutMs: 120_000 }));
  const jobs: RawJob[] = [];

  for (const l of listings) {
    if (!l.active) continue;
    if (!CATEGORIES.has(l.category ?? '')) continue;
    if (l.sponsorship === 'U.S. Citizenship is Required') continue;
    if (!matchesTitleFilter(l.title)) continue; // seniority excludes only

    const location = l.locations?.join('; ') || null;
    const isRemote = /remote/i.test(location ?? '');

    const hints: RawJob['hints'] = { entry: true };
    if (l.sponsorship === 'Offers Sponsorship') hints.sponsor = 'confirmed';
    else if (l.sponsorship === 'Does Not Offer Sponsorship') hints.sponsor = 'blocked';

    jobs.push({
      source:      'simplify',
      external_id: l.id,
      title:       l.title,
      company:     l.company_name,
      location,
      remote:      isRemote,
      url:         l.url,
      description: null,
      posted_at:   l.date_posted ? new Date(l.date_posted * 1000).toISOString() : null,
      hints,
    });
  }

  return jobs;
}
