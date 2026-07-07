import { fetchJson, matchesTitleFilter, withRetry } from './_http';
import type { RawJob } from './greenhouse';

export interface WorkdayConfig {
  company: string;
  tenant: string;
  titleFilter?: string[];
  locationFilter?: string[];
  searchText?: string; // server-side narrowing; huge tenants time out without it
}

interface WDJob {
  id?: string; // not present in CXS list responses
  title: string;
  locationsText?: string;
  bulletFields?: string[]; // [0] is usually the requisition ID (e.g. "R123456")
  externalPath?: string;
  postedOn?: string;
}

interface WDResponse {
  jobPostings?: WDJob[];
  total?: number;
}

export async function scrapeWorkday(config: WorkdayConfig): Promise<RawJob[]> {
  // tenant accepts "acme" (legacy, assumes wd5 + External site) or the full
  // "acme.wd12/Acme_Careers" form since instance host and site name vary.
  const [hostPart, site = 'External'] = config.tenant.split('/');
  const [tenant, wd = 'wd5'] = hostPart.split('.');
  const host = `https://${tenant}.${wd}.myworkdayjobs.com`;
  const baseUrl = `${host}/wday/cxs/${tenant}/${site}/jobs`;
  const jobs: RawJob[] = [];
  let offset = 0;
  const limit = 20; // CXS rejects anything above 20 with a 400
  const maxOffset = 1000; // cap giant tenants (NVIDIA "engineer" alone is 2000+)

  while (offset < maxOffset) {
    const body = JSON.stringify({ appliedFacets: {}, limit, offset, searchText: config.searchText ?? '' });

    const data = await withRetry(() =>
      fetchJson<WDResponse>(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    );

    const postings = data.jobPostings ?? [];
    if (postings.length === 0) break;

    for (const j of postings) {
      if (!matchesTitleFilter(j.title, config.titleFilter)) continue;

      const locationName = j.locationsText ?? '';
      const isRemote = /remote/i.test(locationName);

      if (config.locationFilter && config.locationFilter.length > 0) {
        const locOk = config.locationFilter.some(
          (f) => locationName.toLowerCase().includes(f.toLowerCase()) || isRemote
        );
        if (!locOk) continue;
      }

      const jobUrl = j.externalPath ? `${host}${j.externalPath}` : `${host}/${site}`;

      const externalId = j.id ?? j.bulletFields?.[0] ?? j.externalPath;
      if (!externalId) continue;

      jobs.push({
        source:      'workday',
        external_id: `${tenant}-${externalId}`,
        title:       j.title,
        company:     config.company,
        location:    locationName || null,
        remote:      isRemote,
        url:         jobUrl,
        description: null,
        posted_at:   j.postedOn ?? null,
      });
    }

    offset += postings.length;
    if (!data.total || offset >= data.total) break;
  }

  return jobs;
}
