import type {
  PostEventReport,
  ReportFilterCriteria,
  ReportMetricType,
  DistrictDistributionSummary,
} from '@/types/postEventReport';

export type ReportRecord = Record<string, unknown> & { id: string };
export const REPORT_METRICS: { value: ReportMetricType; label: string; description: string }[] = [
  {
    value: 'alert_timeline',
    label: 'Alert timeline',
    description: 'Warnings issued and changes in severity',
  },
  {
    value: 'citizens_reached',
    label: 'Citizens reached',
    description: 'Recorded delivery counts and their limitations',
  },
  {
    value: 'shelter_occupancy',
    label: 'Shelter occupancy',
    description: 'Recorded headcounts over time',
  },
  {
    value: 'resource_distribution',
    label: 'Resource distribution',
    description: 'Items delivered, grouped by district and unit',
  },
];
export function reportDate(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function')
    return (value as { toDate: () => Date }).toDate().toISOString();
  return '';
}
const number = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const array = (v: unknown): ReportRecord[] => (Array.isArray(v) ? v : []);
export function reportRangeBoundary(value: string, end = false): number {
  return Date.parse(
    value.length === 10 ? `${value}T${end ? '23:59:59.999' : '00:00:00.000'}+05:30` : value
  );
}
export function withinReportRange(value: unknown, criteria: ReportFilterCriteria) {
  const date = Date.parse(reportDate(value));
  if (!Number.isFinite(date)) return false;
  const start = criteria.startDate ? reportRangeBoundary(criteria.startDate) : -Infinity;
  const end = criteria.endDate ? reportRangeBoundary(criteria.endDate, true) : Infinity;
  return date >= start && date <= end;
}
export function aggregatePostEventMetric(
  metric: ReportMetricType,
  records: ReportRecord[],
  criteria: ReportFilterCriteria,
  eventId: string
): { metrics: Partial<PostEventReport['metrics']>; recordCount: number } {
  const district = criteria.district && criteria.district !== 'all' ? criteria.district : '';
  if (metric === 'alert_timeline' || metric === 'citizens_reached') {
    const warnings = records.filter(
      r =>
        ['delivered', 'partially_failed', 'failed', 'active'].includes(String(r.status)) &&
        withinReportRange(r.dispatchedAt || r.createdAt, criteria) &&
        (!district ||
          (Array.isArray(r.resolvedDistricts) && r.resolvedDistricts.includes(district)))
    );
    if (metric === 'alert_timeline') {
      const warningsBySeverity: Record<string, number> = {};
      for (const w of warnings)
        warningsBySeverity[String(w.severity)] = (warningsBySeverity[String(w.severity)] || 0) + 1;
      return {
        recordCount: warnings.length,
        metrics: {
          alerts: {
            totalAlertsIssued: warnings.length,
            escalationCount: warnings.filter(w => w.previousWarningId).length,
            warningsBySeverity,
            timeline: warnings
              .map(w => ({
                timestamp: reportDate(w.dispatchedAt || w.createdAt),
                level: String(w.severity),
                message: String(w.headline || ''),
                warningId: w.id,
              }))
              .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
          },
        },
      };
    }
    let delivered = 0,
      attempted = 0,
      estimatedReach = 0;
    for (const w of warnings) {
      const channels = array(w.channelResults);
      for (const c of channels) {
        attempted += number(c.recipientCount);
        delivered += number(
          c.deliveredCount ??
            (['Success', 'success'].includes(String(c.status)) ? c.recipientCount : 0)
        );
      }
      estimatedReach += Math.max(
        0,
        ...channels.map(c =>
          number(
            c.deliveredCount ??
              (['Success', 'success'].includes(String(c.status)) ? c.recipientCount : 0)
          )
        )
      );
    }
    return {
      recordCount: warnings.length,
      metrics: {
        citizenReach: {
          totalCitizensReached: estimatedReach,
          reachBySector: {},
          notificationDeliveryRate: attempted ? Math.round((delivered / attempted) * 1000) / 10 : 0,
          acknowledgedCount: 0,
          measurementNote:
            'Estimated reach: highest delivered channel count per warning, summed across warnings. Repeated recipients may be counted again. Unique recipients and acknowledgements are not recorded. District filtering selects warnings targeting that district; delivery counts may include other targeted districts. Delivery adapters currently simulate provider outcomes.',
        },
      },
    };
  }
  if (metric === 'shelter_occupancy') {
    const points: { timestamp: string; occupancy: number; capacity: number; shelterId: string }[] =
      [];
    for (const s of records) {
      for (const h of array(s.occupancyHistory)) {
        if (
          (h.hazardEventId || s.hazardEventId) !== eventId ||
          (district && (h.district || s.district) !== district) ||
          !withinReportRange(h.timestamp, criteria)
        )
          continue;
        points.push({
          timestamp: reportDate(h.timestamp),
          occupancy: number(h.occupancy),
          capacity: number(h.capacity),
          shelterId: s.id,
        });
      }
    }
    points.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const current = new Map<string, { occupancy: number; capacity: number }>();
    const days = new Map<string, number>();
    let peak = 0,
      peakCount = 0;
    for (const point of points) {
      current.set(point.shelterId, point);
      const totals = [...current.values()].reduce(
        (sum, p) => ({
          occupancy: sum.occupancy + p.occupancy,
          capacity: sum.capacity + p.capacity,
        }),
        { occupancy: 0, capacity: 0 }
      );
      peakCount = Math.max(peakCount, totals.occupancy);
      peak = Math.max(peak, totals.capacity ? (totals.occupancy / totals.capacity) * 100 : 0);
      const day =
        point.timestamp.length === 10
          ? point.timestamp
          : new Date(Date.parse(point.timestamp) + 330 * 60000).toISOString().slice(0, 10);
      days.set(day, totals.occupancy);
    }
    return {
      recordCount: points.length,
      metrics: {
        shelterOccupancy: {
          totalSheltersActive: current.size,
          totalCapacitiesOccupied: peakCount,
          peakOccupancyPercentage: Math.round(peak * 10) / 10,
          timeSeriesOccupancy: [...days].map(([date, occupancyCount]) => ({
            date,
            occupancyCount,
          })),
        },
      },
    };
  }
  const rows = records.filter(
    r =>
      (!district || r.destinationDistrict === district) &&
      withinReportRange(r.distributedAt, criteria)
  );
  const distributionByDistrict: Record<string, DistrictDistributionSummary> = {};
  for (const row of rows) {
    const key = String(row.destinationDistrict || 'Unknown');
    const group = (distributionByDistrict[key] ||= {
      foodKits: 0,
      medicalKits: 0,
      waterPurifiers: 0,
      blankets: 0,
      tents: 0,
      items: [],
    });
    const amount = number(row.quantity);
    const category = (
      {
        food: 'foodKits',
        medicine: 'medicalKits',
        water: 'waterPurifiers',
        blankets: 'blankets',
        tents: 'tents',
      } as const
    )[row.supplyType as 'food'];
    if (category) group[category] = (group[category] || 0) + amount;
    const name = String(row.supplyName || 'Supply'),
      unit = String(row.unit || 'units');
    const item = group.items!.find(i => i.name === name && i.unit === unit);
    if (item) item.quantity += amount;
    else group.items!.push({ name, unit, quantity: amount });
  }
  return {
    recordCount: rows.length,
    metrics: {
      resourceDistribution: {
        totalPackagesDistributed: rows.reduce((sum, r) => sum + number(r.quantity), 0),
        distributionByDistrict,
      },
    },
  };
}
