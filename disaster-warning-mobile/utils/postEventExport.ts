import { jsPDF } from 'jspdf/dist/jspdf.es.min.js';
import type { PostEventReport, ExportFormat, ReportExportArtifact } from '@/types/postEventReport';

function displayDate(value: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return value;
  return new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(value.length > 10 ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  });
}

export function postEventReportRows(report: PostEventReport): string[][] {
  const rows: string[][] = [
    ['Report', 'Event', report.eventTitle, '', '', ''],
    ['Report', 'Generated (Sri Lanka time)', displayDate(report.generatedAt), '', '', ''],
    [
      'Report',
      'District',
      report.filterCriteria.district === 'all' || !report.filterCriteria.district
        ? 'All affected districts'
        : report.filterCriteria.district,
      '',
      '',
      '',
    ],
    [
      'Report',
      'Start date',
      displayDate(report.filterCriteria.startDate || 'All dates'),
      '',
      '',
      '',
    ],
    ['Report', 'End date', displayDate(report.filterCriteria.endDate || 'All dates'), '', '', ''],
    ['Report', 'Status', report.overallStatus.replace(/_/g, ' '), '', '', ''],
  ];
  for (const [metric, error] of Object.entries(report.metricErrors || {}))
    rows.push(['Incomplete metric', metric, error, '', '', '']);
  const { alerts, citizenReach, shelterOccupancy, resourceDistribution } = report.metrics;
  if (alerts && typeof alerts !== 'string') {
    rows.push(['Alerts', 'Total warnings', String(alerts.totalAlertsIssued), 'warnings', '', '']);
    rows.push(['Alerts', 'Follow-up warnings', String(alerts.escalationCount), 'warnings', '', '']);
    for (const e of alerts.timeline)
      rows.push(['Alert timeline', e.message, e.level, '', displayDate(e.timestamp), '']);
  }
  if (citizenReach && typeof citizenReach !== 'string') {
    rows.push([
      'Reach',
      'Estimated reach',
      String(citizenReach.totalCitizensReached),
      'recipient exposures',
      '',
      '',
    ]);
    rows.push([
      'Reach',
      'Channel delivery rate',
      String(citizenReach.notificationDeliveryRate),
      '%',
      '',
      '',
    ]);
    rows.push(['Reach', 'Measurement note', citizenReach.measurementNote || '', '', '', '']);
  }
  if (shelterOccupancy && typeof shelterOccupancy !== 'string') {
    rows.push([
      'Shelters',
      'Shelters with recorded headcounts',
      String(shelterOccupancy.totalSheltersActive),
      'shelters',
      '',
      '',
    ]);
    rows.push([
      'Shelters',
      'Peak recorded occupants',
      String(shelterOccupancy.totalCapacitiesOccupied),
      'people',
      '',
      '',
    ]);
    rows.push([
      'Shelters',
      'Peak recorded occupancy rate',
      String(shelterOccupancy.peakOccupancyPercentage),
      '%',
      '',
      '',
    ]);
    for (const p of shelterOccupancy.timeSeriesOccupancy)
      rows.push([
        'Shelter occupancy',
        'Recorded headcount',
        String(p.occupancyCount),
        'people',
        displayDate(p.date),
        '',
      ]);
  }
  if (resourceDistribution && typeof resourceDistribution !== 'string') {
    for (const [district, group] of Object.entries(resourceDistribution.distributionByDistrict))
      for (const item of group.items || [])
        rows.push(['Distribution', item.name, String(item.quantity), item.unit, '', district]);
  }
  return rows;
}
export function reportCsv(report: PostEventReport): string {
  const cell = (text: string) =>
    '"' + (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"';
  return (
    '\uFEFF' +
    [
      [
        'Section',
        'Description / metric',
        'Value / severity',
        'Unit',
        'Date (Sri Lanka time)',
        'District',
      ],
      ...postEventReportRows(report),
    ]
      .map(row => row.map(cell).join(','))
      .join('\r\n')
  );
}
export function encodeReportBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function buildReportPdf(report: PostEventReport): Uint8Array {
  const pdf = new jsPDF();
  const rows = postEventReportRows(report);
  const blue = [8, 85, 217] as const;
  let y = 0;
  const header = (first: boolean) => {
    pdf.setFillColor(...blue);
    pdf.rect(0, 0, 210, first ? 58 : 25, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(first ? 22 : 13);
    pdf.text('DisasterGuard', 15, first ? 19 : 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(first ? 12 : 9);
    pdf.text('POST-EVENT RESPONSE REPORT', 15, first ? 28 : 19);
    if (first) {
      pdf.setFontSize(12);
      const title: string[] = pdf.splitTextToSize(report.eventTitle, 180);
      // Reserve as much room as the full event title needs.
      const bottom = Math.max(58, 40 + title.length * 6 + 7);
      pdf.setFillColor(...blue);
      pdf.rect(0, 30, 210, bottom - 30, 'F');
      pdf.text(title, 15, 40);
      y = bottom + 10;
    } else y = 35;
  };
  const space = (height: number) => {
    if (y + height > 275) {
      pdf.addPage();
      header(false);
    }
  };
  header(true);
  const summary = rows
    .filter(row => row[0] !== 'Report' && row[3] && !row[4] && !row[5])
    .slice(0, 4);
  summary.forEach((row, index) => {
    if (index % 2 === 0) space(30);
    const x = index % 2 === 0 ? 15 : 107;
    pdf.setFillColor(237, 244, 255);
    pdf.roundedRect(x, y, 88, 27, 3, 3, 'F');
    pdf.setTextColor(...blue);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(19);
    pdf.text(row[2], x + 5, y + 10);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(70, 89, 115);
    pdf.text(pdf.splitTextToSize(`${row[1]} (${row[3]})`, 78), x + 5, y + 17);
    if (index % 2 === 1 || index === summary.length - 1) y += 32;
  });
  let section = '';
  let alternating = false;
  const sectionHeading = (name: string, continued = false) => {
    space(19);
    pdf.setFillColor(229, 239, 255);
    pdf.roundedRect(15, y, 180, 10, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...blue);
    pdf.text(name + (continued ? ' (continued)' : ''), 19, y + 7);
    y += 14;
  };
  for (const row of rows) {
    if (row[0] !== section) {
      section = row[0];
      space(32);
      sectionHeading(section);
      alternating = false;
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const details = [row[2] + (row[3] ? ` ${row[3]}` : ''), row[4], row[5]]
      .filter(Boolean)
      .join('  /  ');
    const labels: string[] = pdf.splitTextToSize(row[1], 68);
    const values: string[] = pdf.splitTextToSize(details || '-', 96);
    const lines = Math.max(labels.length, values.length);
    let start = 0;
    while (start < lines) {
      if (y + 13 > 275) {
        pdf.addPage();
        header(false);
        sectionHeading(section, true);
      }
      const count = Math.min(lines - start, Math.max(1, Math.floor((275 - y - 7) / 5)));
      const height = count * 5 + 7;
      if (alternating) pdf.setFillColor(244, 248, 253);
      else pdf.setFillColor(255, 255, 255);
      pdf.rect(15, y, 180, height, 'F');
      pdf.setDrawColor(224, 233, 246);
      pdf.line(15, y + height, 195, y + height);
      pdf.setTextColor(76, 94, 119);
      pdf.text(labels.slice(start, start + count), 19, y + 6);
      pdf.setTextColor(20, 35, 55);
      pdf.text(values.slice(start, start + count), 94, y + 6);
      y += height;
      start += count;
    }
    alternating = !alternating;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(224, 233, 246);
    pdf.line(15, 282, 195, 282);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(90, 108, 132);
    pdf.text('DisasterGuard | Response analysis | Times shown in Sri Lanka time', 15, 288);
    pdf.text(`${page} / ${pages}`, 195, 288, { align: 'right' });
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}
export function buildReportExport(
  report: PostEventReport,
  format: ExportFormat
): ReportExportArtifact {
  let bytes: Uint8Array;
  if (format === 'csv') bytes = new TextEncoder().encode(reportCsv(report));
  else {
    bytes = buildReportPdf(report);
  }
  return {
    fileName: `DisasterGuard-${report.id}.${format}`,
    format,
    mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
    base64: encodeReportBytes(bytes),
  };
}
