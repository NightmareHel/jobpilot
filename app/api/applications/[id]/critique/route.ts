import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { applications, jobs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { critiqueApplication } from '@/lib/claude';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!app.resume_text) {
    return NextResponse.json({ error: 'No resume text to critique' }, { status: 400 });
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, app.job_id));
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const jdText = job.description ?? `${job.title} at ${job.company}`;

  try {
    const result = await critiqueApplication(app.resume_text, jdText);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Critique failed: ${msg}` }, { status: 500 });
  }
}
