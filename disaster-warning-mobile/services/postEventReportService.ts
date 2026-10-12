import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { requireDmcActor } from './workflowAuthorization';
import type { HazardEvent } from '@/types/resources';
import type {
  PostEventReport,
  ReportFilterCriteria,
  ReportMetricType,
  ExportFormat,
  DonorDistributionRecord,
  RegisteredDonor,
  ReportExportArtifact,
} from '@/types/postEventReport';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import {
  aggregatePostEventMetric,
  REPORT_METRICS,
  reportDate,
  reportRangeBoundary,
  type ReportRecord,
} from '@/utils/postEventMetrics';
import { buildReportExport } from '@/utils/postEventExport';

const reports = 'postEventReports';
const mapEvent = (id: string, data: Record<string, unknown>): HazardEvent => ({
  id,
  title: String(data.title || ''),
  status: data.status as HazardEvent['status'],
  hazardType: data.hazardType as HazardEvent['hazardType'],
  affectedDistricts: (data.affectedDistricts || []) as string[],
  startDate: reportDate(data.startDate),
  ...(data.closedAt ? { closedAt: reportDate(data.closedAt) } : {}),
  description: String(data.description || ''),
});
export async function getClosedHazardEvents(): Promise<HazardEvent[]> {
  await requireDmcActor();
  const snapshot = await getDocs(
    query(collection(db, 'hazardEvents'), where('status', '==', 'closed'))
  );
  return snapshot.docs
    .map(d => mapEvent(d.id, d.data()))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}
export function validateReportCriteria(
  event: HazardEvent | null,
  criteria: ReportFilterCriteria
): { valid: boolean; error?: string } {
  const fail = (error: string) => ({ valid: false, error });
  if (!event?.id) return fail('A valid hazard event must be selected.');
  if (event.status !== 'closed')
    return fail('Event Not Closed: Select a completed/closed hazard event.');
  if (!criteria.selectedMetrics?.length)
    return fail('At least one report metric must be selected.');
  if (criteria.selectedMetrics.some(m => !REPORT_METRICS.some(option => option.value === m)))
    return fail('Select valid report metrics.');
  for (const date of [criteria.startDate, criteria.endDate]) {
    if (
      date &&
      (!Number.isFinite(Date.parse(date)) ||
        (date.length === 10 && new Date(date).toISOString().slice(0, 10) !== date))
    )
      return fail('Invalid date range: Enter valid dates.');
  }
  if (
    criteria.startDate &&
    criteria.endDate &&
    reportRangeBoundary(criteria.startDate) > reportRangeBoundary(criteria.endDate, true)
  )
    return fail('Invalid date range: Start date must be before or equal to End date.');
  if (
    criteria.district &&
    criteria.district !== 'all' &&
    !(SRI_LANKAN_DISTRICTS as readonly string[]).includes(criteria.district)
  )
    return fail(`Invalid district filter: "${criteria.district}".`);
  if (
    criteria.district &&
    criteria.district !== 'all' &&
    !event.affectedDistricts.includes(criteria.district)
  )
    return fail('Select a district affected by this event.');
  return { valid: true };
}
async function withTimeout<T>(operation: Promise<T>, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Data source timeout. Please retry.')),
          milliseconds
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function readSources(metric: ReportMetricType, eventId: string): Promise<ReportRecord[]> {
  const name =
    metric === 'shelter_occupancy'
      ? 'shelters'
      : metric === 'resource_distribution'
        ? 'distributions'
        : 'warnings';
  const ref = collection(db, name);
  // All shelters include event-tagged historical headcounts, even after reassignment.
  const source =
    name === 'shelters'
      ? ref
      : query(ref, where(name === 'warnings' ? 'eventId' : 'hazardEventId', '==', eventId));
  const snapshot = await withTimeout(getDocs(source));
  return snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
}
export async function generatePostEventReport(
  event: HazardEvent,
  criteria: ReportFilterCriteria,
  userId: string
): Promise<PostEventReport> {
  await requireDmcActor(userId);
  const stored = await getDoc(doc(db, 'hazardEvents', event.id));
  const current = stored.exists() ? mapEvent(stored.id, stored.data()) : null;
  const normalized = { ...criteria, selectedMetrics: [...new Set(criteria.selectedMetrics || [])] };
  const validation = validateReportCriteria(current, normalized);
  if (!validation.valid) throw new Error(validation.error);
  const metrics: PostEventReport['metrics'] = {
    alerts: null,
    citizenReach: null,
    shelterOccupancy: null,
    resourceDistribution: null,
  };
  const failedMetrics: string[] = [],
    metricErrors: Record<string, string> = {};
  const sourceCache = new Map<string, Promise<ReportRecord[]>>();
  let recordCount = 0;
  await Promise.all(
    normalized.selectedMetrics.map(async metric => {
      const key =
        metric === 'alert_timeline' || metric === 'citizens_reached' ? 'warnings' : metric;
      try {
        if (!sourceCache.has(key)) sourceCache.set(key, readSources(metric, event.id));
        const result = aggregatePostEventMetric(
          metric,
          await sourceCache.get(key)!,
          normalized,
          event.id
        );
        Object.assign(metrics, result.metrics);
        recordCount += result.recordCount;
      } catch (error) {
        failedMetrics.push(metric);
        metricErrors[metric] = (error as Error).message || 'Could not read this data source.';
        const field = (
          {
            alert_timeline: 'alerts',
            citizens_reached: 'citizenReach',
            shelter_occupancy: 'shelterOccupancy',
            resource_distribution: 'resourceDistribution',
          } as const
        )[metric];
        metrics[field] = 'Incomplete/Timeout';
      }
    })
  );
  if (failedMetrics.length === normalized.selectedMetrics.length)
    throw new Error(
      'Report generation failed: Could not read the selected data sources. Retry generation.'
    );
  if (recordCount === 0 && !failedMetrics.length)
    throw new Error('No records found for the selected reporting criteria and filters.');
  // Check persisted event state again before storing a report.
  const latest = await getDoc(doc(db, 'hazardEvents', event.id));
  if (!latest.exists() || latest.data().status !== 'closed')
    throw new Error('Event Not Closed: The event is no longer available for reporting.');
  const data: Omit<PostEventReport, 'id'> = {
    eventId: event.id,
    eventTitle: current!.title,
    generatedBy: userId,
    generatedAt: new Date().toISOString(),
    filterCriteria: normalized,
    overallStatus: failedMetrics.length ? 'PARTIAL_SUCCESS' : 'COMPLETE',
    summary: {
      totalMetricsCount: normalized.selectedMetrics.length,
      successfulMetricsCount: normalized.selectedMetrics.length - failedMetrics.length,
      failedMetricsCount: failedMetrics.length,
    },
    metrics,
    failedMetrics,
    metricErrors,
  };
  const ref = await addDoc(collection(db, reports), { ...data, createdAt: serverTimestamp() });
  return { id: ref.id, ...data };
}
export async function getPostEventReports(): Promise<PostEventReport[]> {
  await requireDmcActor();
  const snapshot = await getDocs(collection(db, reports));
  return snapshot.docs
    .map(d => ({ ...d.data(), id: d.id }) as PostEventReport)
    .sort((a, b) => (b.generatedAt || '').localeCompare(a.generatedAt || ''));
}
export async function exportReport(
  reportId: string,
  format: ExportFormat
): Promise<{
  success: boolean;
  exportUrl: string;
  format: ExportFormat;
  artifact: ReportExportArtifact;
}> {
  await requireDmcActor();
  if (!['pdf', 'csv'].includes(format))
    throw new Error('Unsupported export format. Choose PDF or CSV.');
  const snapshot = await getDoc(doc(db, reports, reportId));
  if (!snapshot.exists()) throw new Error('Report not found.');
  const report = { ...snapshot.data(), id: reportId } as PostEventReport;
  const artifact = buildReportExport(report, format);
  if (artifact.base64.length > 800000)
    throw new Error('Export is too large. Narrow the date range or district and retry.');
  const exportUrl = `report-export:${reportId}:${format}`;
  const batch = writeBatch(db);
  batch.set(doc(db, reports, reportId, 'exports', format), {
    ...artifact,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, reports, reportId), {
    exportUrl,
    exportFormat: format,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return { success: true, exportUrl, format, artifact };
}
export async function getReportExport(
  reportId: string,
  format: ExportFormat
): Promise<ReportExportArtifact> {
  await requireDmcActor();
  if (!['pdf', 'csv'].includes(format))
    throw new Error('Unsupported export format. Choose PDF or CSV.');
  const result = await getDoc(doc(db, reports, reportId, 'exports', format));
  if (!result.exists()) throw new Error('Export file not found. Export the report again.');
  return result.data() as ReportExportArtifact;
}
export async function getRegisteredDonors(): Promise<RegisteredDonor[]> {
  await requireDmcActor();
  const result = await getDocs(collection(db, 'donorOrganisations'));
  return result.docs
    .map(d => ({ id: d.id, name: d.data().name, email: d.data().email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export async function registerDonor(name: string, email: string): Promise<RegisteredDonor> {
  const uid = await requireDmcActor();
  name = name.trim();
  email = email.trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Enter an organisation name and valid email address.');
  const ref = await addDoc(collection(db, 'donorOrganisations'), {
    name,
    email,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, name, email };
}
export async function distributeReportToDonor(
  reportId: string,
  eventId: string,
  donorId: string,
  _donorName: string,
  format: ExportFormat,
  fileUrl: string,
  userId: string
): Promise<DonorDistributionRecord> {
  await requireDmcActor(userId);
  if (!donorId) throw new Error('Select a registered donor organisation.');
  const donor = await getDoc(doc(db, 'donorOrganisations', donorId));
  const report = await getDoc(doc(db, reports, reportId));
  if (!donor.exists() || !report.exists()) throw new Error('The donor or report no longer exists.');
  if (report.data().overallStatus !== 'COMPLETE' || report.data().failedMetrics?.length)
    throw new Error('Incomplete reports cannot be shared. Regenerate the affected metrics first.');
  if (report.data().eventId !== eventId || fileUrl !== `report-export:${reportId}:${format}`)
    throw new Error('The exported file does not match this report.');
  await getReportExport(reportId, format);
  const data: Omit<DonorDistributionRecord, 'id'> = {
    reportId,
    eventId,
    donorId,
    donorName: donor.data().name,
    donorEmail: donor.data().email,
    format,
    fileUrl,
    distributedBy: userId,
    distributedAt: new Date().toISOString(),
    status: 'SHARED',
  };
  const result = await addDoc(collection(db, 'donorDistributions'), data);
  return { id: result.id, ...data };
}
export async function getDonorDistributionHistory(
  reportId: string
): Promise<DonorDistributionRecord[]> {
  await requireDmcActor();
  const snapshot = await getDocs(
    query(collection(db, 'donorDistributions'), where('reportId', '==', reportId))
  );
  return snapshot.docs
    .map(d => ({ ...d.data(), id: d.id }) as DonorDistributionRecord)
    .sort((a, b) => b.distributedAt.localeCompare(a.distributedAt));
}
