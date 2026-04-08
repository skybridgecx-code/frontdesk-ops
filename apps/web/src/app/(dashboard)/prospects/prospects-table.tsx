'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable } from '../components/data-table';
import { StatusBadge } from '../components/status-badge';

type ProspectRow = {
  prospectSid: string;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: string;
  priority: string | null;
  updatedAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function priorityDot(priority: string | null) {
  const normalized = priority?.toLowerCase() ?? '';

  if (normalized === 'high') {
    return 'bg-rose-500';
  }

  if (normalized === 'medium') {
    return 'bg-amber-500';
  }

  if (normalized === 'low') {
    return 'bg-emerald-500';
  }

  return 'bg-gray-300';
}

function displayName(prospect: ProspectRow) {
  return prospect.companyName ?? prospect.contactName ?? prospect.prospectSid;
}

export function ProspectsTable({
  prospects,
  returnTo
}: {
  prospects: ProspectRow[];
  returnTo: string;
}) {
  const router = useRouter();

  return (
    <>
      <div className="hidden md:block">
        <DataTable>
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Last Updated</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((prospect) => (
              <tr
                key={prospect.prospectSid}
                onClick={() =>
                  router.push(`/prospects/${prospect.prospectSid}?returnTo=${encodeURIComponent(returnTo)}`)
                }
                className="cursor-pointer border-b border-gray-100 text-sm text-gray-700 transition hover:bg-indigo-50"
              >
                <td className="px-4 py-3 font-medium text-gray-900">{displayName(prospect)}</td>
                <td className="px-4 py-3 text-gray-600">{prospect.contactName ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{prospect.contactPhone ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{prospect.contactEmail ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge value={prospect.status} type="prospect" />
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-gray-600">
                    <span className={`h-2.5 w-2.5 rounded-full ${priorityDot(prospect.priority)}`} />
                    <span>
                      {prospect.priority
                        ? prospect.priority.charAt(0).toUpperCase() + prospect.priority.slice(1).toLowerCase()
                        : 'None'}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{formatDate(prospect.updatedAt)}</td>
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <Link
                    href={`/prospects/${prospect.prospectSid}?returnTo=${encodeURIComponent(returnTo)}`}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-indigo-50"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <div className="grid gap-3 md:hidden">
        {prospects.map((prospect) => (
          <article
            key={prospect.prospectSid}
            onClick={() =>
              router.push(`/prospects/${prospect.prospectSid}?returnTo=${encodeURIComponent(returnTo)}`)
            }
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{displayName(prospect)}</p>
                <p className="mt-1 text-xs text-gray-500">{prospect.contactName ?? 'No contact name'}</p>
              </div>
              <StatusBadge value={prospect.status} type="prospect" />
            </div>

            <div className="mt-3 grid gap-1 text-xs text-gray-600">
              <p>Phone: {prospect.contactPhone ?? '—'}</p>
              <p>Email: {prospect.contactEmail ?? '—'}</p>
              <p>Updated: {formatDate(prospect.updatedAt)}</p>
            </div>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600">
              <span className={`h-2.5 w-2.5 rounded-full ${priorityDot(prospect.priority)}`} />
              <span>
                Priority:{' '}
                {prospect.priority
                  ? prospect.priority.charAt(0).toUpperCase() + prospect.priority.slice(1).toLowerCase()
                  : 'None'}
              </span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
