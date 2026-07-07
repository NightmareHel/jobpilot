import { fetchJson, matchesTitleFilter, withRetry } from './_http';
import type { RawJob } from './greenhouse';
import type { ScraperConfig } from './greenhouse';

// SmartRecruiters public postings API. The list call has no descriptions, so
// a detail fetch runs per title-matched job. Unknown company identifiers
// return 200 with totalFound 0 (never a 404) — health is count-based.
interface SRPosting {
  id: string;
  name: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean; fullLocation?: string };
  experienceLevel?: { label?: string };
}

interface SRListResponse {
  totalFound: number;
  content: SRPosting[];
}

interface SRDetail {
  applyUrl?: string;
  postingUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
}

export async function scrapeSmartRecruiters(config: ScraperConfig): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  let offset = 0;

  while (true) {
    const list = await withRetry(() =>
      fetchJson<SRListResponse>(
        `https://api.smartrecruiters.com/v1/companies/${config.slug}/postings?limit=100&offset=${offset}`
      )
    );

    for (const p of list.content ?? []) {
      if (!matchesTitleFilter(p.name, config.titleFilter)) continue;

      const isRemote = p.location?.remote === true;
      const country = p.location?.country ?? '';
      if (!isRemote && country && !/^(us|usa|united states)$/i.test(country)) continue;

      let description: string | null = null;
      let url = `https://jobs.smartrecruiters.com/${config.slug}/${p.id}`;
      try {
        const detail = await withRetry(() =>
          fetchJson<SRDetail>(`https://api.smartrecruiters.com/v1/companies/${config.slug}/postings/${p.id}`)
        );
        const sections = detail.jobAd?.sections ?? {};
        description = Object.values(sections)
          .map((s) => [s.title, s.text].filter(Boolean).join('\n'))
          .join('\n\n') || null;
        url = detail.postingUrl ?? detail.applyUrl ?? url;
      } catch {
        // keep the job with list-level data only
      }

      const location =
        p.location?.fullLocation ??
        [p.location?.city, p.location?.region, country].filter(Boolean).join(', ') ??
        null;
      const entry = /entry/i.test(p.experienceLevel?.label ?? '');

      jobs.push({
        source:      'smartrecruiters',
        external_id: p.id,
        title:       p.name,
        company:     config.company,
        location:    location || null,
        remote:      isRemote,
        url,
        description,
        posted_at:   p.releasedDate ?? null,
        hints:       entry ? { entry: true } : undefined,
      });
    }

    offset += list.content?.length ?? 0;
    if (!list.content?.length || offset >= list.totalFound) break;
  }

  return jobs;
}
