import { fetchJson, matchesTitleFilter, withRetry } from './_http';
import type { RawJob } from './greenhouse';
import type { ScraperConfig } from './greenhouse';

// Workable public widget API: one GET, full descriptions inline.
interface WorkableJob {
  title: string;
  shortcode: string;
  url: string;
  application_url?: string;
  telecommuting?: boolean;
  country?: string;
  city?: string;
  state?: string;
  experience?: string; // "Entry level" | "Mid-Senior level" | ...
  published_on?: string;
  description?: string;
}

interface WorkableResponse {
  name?: string;
  jobs?: WorkableJob[];
}

export async function scrapeWorkable(config: ScraperConfig): Promise<RawJob[]> {
  const url = `https://apply.workable.com/api/v1/widget/accounts/${config.slug}?details=true`;
  const data = await withRetry(() => fetchJson<WorkableResponse>(url));
  const jobs: RawJob[] = [];

  for (const j of data.jobs ?? []) {
    if (!matchesTitleFilter(j.title, config.titleFilter)) continue;

    const isRemote = j.telecommuting === true;
    // US-wide scope: keep US postings and remote ones
    if (!isRemote && j.country && !/united states|usa/i.test(j.country)) continue;

    const location = [j.city, j.state, j.country].filter(Boolean).join(', ') || null;

    jobs.push({
      source:      'workable',
      external_id: j.shortcode,
      title:       j.title,
      company:     config.company,
      location,
      remote:      isRemote,
      url:         j.url ?? j.application_url ?? `https://apply.workable.com/${config.slug}/`,
      description: j.description ?? null,
      posted_at:   j.published_on ?? null,
      hints: j.experience === 'Entry level' ? { entry: true } : undefined,
    });
  }

  return jobs;
}
