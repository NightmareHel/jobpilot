import { fetchJson, matchesTitleFilter, withRetry } from './_http';
import type { RawJob } from './greenhouse';

// The Muse public API: free aggregator with a real entry-level filter and
// full descriptions. Category filter is mandatory or it returns cafe jobs.
const BASE =
  'https://www.themuse.com/api/public/jobs?category=Software%20Engineering&level=Entry%20Level';
const MAX_PAGES = 10;

interface MuseJob {
  id: number;
  name: string;
  contents?: string;
  publication_date?: string;
  locations?: { name: string }[];
  company?: { name?: string };
  refs?: { landing_page?: string };
}

interface MuseResponse {
  page: number;
  page_count: number;
  results: MuseJob[];
}

export async function scrapeTheMuse(): Promise<RawJob[]> {
  const jobs: RawJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await withRetry(() => fetchJson<MuseResponse>(`${BASE}&page=${page}`));

    for (const j of data.results ?? []) {
      if (!matchesTitleFilter(j.name)) continue;
      if (!j.refs?.landing_page) continue;

      const location = j.locations?.map((l) => l.name).join('; ') || null;
      const isRemote = /remote|flexible/i.test(location ?? '');

      jobs.push({
        source:      'themuse',
        external_id: String(j.id),
        title:       j.name,
        company:     j.company?.name ?? 'Unknown',
        location,
        remote:      isRemote,
        url:         j.refs.landing_page,
        description: j.contents ?? null,
        posted_at:   j.publication_date ?? null,
        hints:       { entry: true }, // level=Entry Level is part of the query
      });
    }

    if (page >= (data.page_count ?? 1)) break;
  }

  return jobs;
}
