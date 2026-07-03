import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { getDb } from '@/lib/db';
import { jobs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { jobId } from '@/lib/ids';

const ATS_SUFFIXES = [
  ' | Greenhouse', ' | Lever', ' | Ashby',
  ' | LinkedIn', ' | Indeed', ' | Workday',
  ' — LinkedIn', ' - LinkedIn',
];

function parseJobMeta(rawTitle: string, ogSiteName: string | null): { title: string; company: string } {
  let cleaned = rawTitle;
  for (const suffix of ATS_SUFFIXES) {
    if (cleaned.toLowerCase().endsWith(suffix.toLowerCase())) {
      cleaned = cleaned.slice(0, cleaned.length - suffix.length);
      break;
    }
  }

  if (cleaned.includes(' | ')) {
    const parts = cleaned.split(' | ');
    return { title: parts[0].trim(), company: ogSiteName ?? parts.slice(1).join(' | ').trim() };
  }

  const dashIdx = cleaned.lastIndexOf(' - ');
  if (dashIdx > 0) {
    const maybeCompany = cleaned.slice(dashIdx + 3).trim();
    if (maybeCompany.length > 0 && maybeCompany.length <= 60) {
      return { title: cleaned.slice(0, dashIdx).trim(), company: ogSiteName ?? maybeCompany };
    }
  }

  return { title: cleaned.trim(), company: ogSiteName ?? '' };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const url: string | undefined = body?.url;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  try { new URL(url); } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const db = getDb();

  const existing = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.url, url));
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Job already exists' }, { status: 409 });
  }

  let title = '';
  let company = '';
  let description: string | null = null;
  let fetchError: string | null = null;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

    const rawTitle = await page.title();
    const ogSiteName = await page.evaluate(() => {
      const el = document.querySelector('meta[property="og:site_name"]');
      return el ? el.getAttribute('content') : null;
    });
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 6000));

    const parsed = parseJobMeta(rawTitle, ogSiteName);
    title = parsed.title || url;
    company = parsed.company;
    description = bodyText || null;
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  } finally {
    await browser.close();
  }

  if (fetchError) {
    return NextResponse.json({ error: `Could not load URL: ${fetchError}` }, { status: 400 });
  }

  const id = jobId('custom', url);
  const now = new Date().toISOString();

  try {
    await db.insert(jobs).values({
      id,
      source:      'custom',
      external_id: url,
      title,
      company,
      location:    null,
      remote:      0,
      url,
      description,
      scraped_at:  now,
      status:      'new',
    });
  } catch {
    return NextResponse.json({ error: 'Job already exists' }, { status: 409 });
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  return NextResponse.json({ job });
}
