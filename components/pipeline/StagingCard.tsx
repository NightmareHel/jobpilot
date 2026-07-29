'use client';

import { SPONSOR_BADGE, scoreBadge, BTN } from '@/lib/ui';

export interface StagingJob {
  id: string;
  title: string;
  company: string;
  url: string;
  fit_score: number | null;
  fit_grade: string | null;
  sponsor_status?: string | null;
  sponsor_evidence?: string | null;
  sponsor_lca_count?: number | null;
}

interface Props {
  job: StagingJob;
  onTailor: (id: string) => void;
  onMarkSubmitted: (id: string) => void;
  onUnstage: (id: string) => void;
  tailoring?: boolean;
  tailoringLabel?: string;
}

export default function StagingCard({ job, onTailor, onMarkSubmitted, onUnstage, tailoring, tailoringLabel }: Props) {
  const sponsor = job.sponsor_status;

  return (
    <div className="bg-surface border border-seam rounded-[8px] shadow-card overflow-hidden">
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-graphite font-medium text-sm truncate leading-snug">{job.title}</p>
            <p className="text-stone text-xs truncate">{job.company}</p>
          </div>
          {job.fit_score !== null && (
            <span className={`text-xs tabular-nums font-mono px-1.5 py-0.5 rounded-[4px] flex-shrink-0 ${scoreBadge(job.fit_score)}`}>
              {Math.round(job.fit_score)}{job.fit_grade ? ` ${job.fit_grade}` : ''}
            </span>
          )}
        </div>
        {sponsor && sponsor !== 'unknown' && (
          <div className="mt-1.5">
            <span
              className={`text-xs px-1.5 py-0.5 rounded-[4px] ${SPONSOR_BADGE[sponsor] ?? SPONSOR_BADGE.unknown}`}
              title={job.sponsor_evidence ?? undefined}
            >
              {sponsor === 'confirmed' || sponsor === 'likely' ? 'Sponsors' : sponsor === 'blocked' || sponsor === 'unlikely' ? 'No Sponsor' : sponsor}
              {(sponsor === 'confirmed' || sponsor === 'likely') && job.sponsor_lca_count ? ` (${job.sponsor_lca_count})` : ''}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-hairline px-3 py-2 flex items-center gap-2">
        <button
          onClick={() => onTailor(job.id)}
          disabled={tailoring}
          className={`text-xs px-2.5 py-1 disabled:opacity-60 ${BTN.primary}`}
          title="Tailor a resume for this job"
        >
          {tailoring ? tailoringLabel ?? 'Tailoring...' : 'Tailor'}
        </button>
        {!tailoring && (
          <button
            onClick={() => onMarkSubmitted(job.id)}
            className={`text-xs px-2 py-1 ${BTN.secondary}`}
            title="Applied by hand — move straight to Submitted (no tailoring)"
          >
            Submitted
          </button>
        )}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs ${BTN.ghost}`}
          title="Open original job posting"
        >
          Job
        </a>
        {!tailoring && (
          <button
            onClick={() => onUnstage(job.id)}
            className="ml-auto text-xs text-stone hover:text-red-700 transition-colors"
            title="Remove from staging"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
