import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer } from './ScreenContainer';
import { ReportScreenHero } from './ReportScreenHero';
import { Select } from './Select';
import { Input } from './Input';
import { OfficerButton, officerScreenStyle, officerShellStyle } from './OfficerUi';
import { MobileNavBar } from './MobileNavBar';
import { FormModal } from './FormModal';
import { ReportDatePicker } from './ReportDatePicker';
import { LightColors, MobileTypography } from '@/constants/colors';
import { REPORT_METRICS } from '@/utils/postEventMetrics';
import {
  getClosedHazardEvents,
  generatePostEventReport,
  getPostEventReports,
  exportReport,
  getReportExport,
  getRegisteredDonors,
  registerDonor,
  distributeReportToDonor,
  getDonorDistributionHistory,
} from '@/services/postEventReportService';
import { saveReportFile } from '@/services/postEventFileService';
import type { HazardEvent } from '@/types/resources';
import type {
  PostEventReport,
  RegisteredDonor,
  DonorDistributionRecord,
  ReportMetricType,
  ExportFormat,
} from '@/types/postEventReport';

function BarRows({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <View style={styles.gap}>
      {rows.length ? (
        rows.map((row, i) => (
          <View key={i} style={styles.gapSmall}>
            <View style={styles.row}>
              <Text style={[styles.body, styles.flex]}>{row.label}</Text>
              <Text style={styles.bold}>
                {row.value} {unit}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${(row.value / max) * 100}%` }]} />
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.caption}>No matching records for this metric.</Text>
      )}
    </View>
  );
}
export function PostEventReports() {
  const router = useRouter();
  const { state } = useAuth();
  const insets = useSafeAreaInsets();
  const isDmc = state.user?.role === 'dmc_officer';
  const [events, setEvents] = useState<HazardEvent[]>([]),
    [saved, setSaved] = useState<PostEventReport[]>([]);
  const [eventId, setEventId] = useState(''),
    [selected, setSelected] = useState<ReportMetricType[]>(REPORT_METRICS.map(m => m.value));
  const [startDate, setStart] = useState(''),
    [endDate, setEnd] = useState(''),
    [district, setDistrict] = useState('all');
  const [report, setReport] = useState<PostEventReport | null>(null),
    [history, setHistory] = useState(false);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const lock = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const [donors, setDonors] = useState<RegisteredDonor[]>([]),
    [donorId, setDonorId] = useState('');
  const [donorModal, setDonorModal] = useState(false),
    [donorName, setDonorName] = useState(''),
    [donorEmail, setDonorEmail] = useState('');
  const [sharing, setSharing] = useState(false),
    [audit, setAudit] = useState<DonorDistributionRecord[]>([]);
  const donorFeedback = useFormFeedback({ name: donorName, email: donorEmail }, donorModal);
  const event = events.find(e => e.id === eventId);
  const donor = donors.find(d => d.id === donorId);
  const refineReport = () => {
    if (!report) return;
    setEventId(report.eventId);
    setSelected(report.filterCriteria.selectedMetrics);
    setStart(report.filterCriteria.startDate || '');
    setEnd(report.filterCriteria.endDate || '');
    setDistrict(report.filterCriteria.district || 'all');
    setHistory(false);
    setReport(null);
    setSharing(false);
    setError('');
  };
  const load = useCallback(async () => {
    if (!isDmc) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [closed, previous, organisations] = await Promise.allSettled([
        getClosedHazardEvents(),
        getPostEventReports(),
        getRegisteredDonors(),
      ]);
      if (closed.status === 'fulfilled') setEvents(closed.value);
      if (previous.status === 'fulfilled') setSaved(previous.value);
      if (organisations.status === 'fulfilled') setDonors(organisations.value);
      const errors = [closed, previous, organisations].filter(
        result => result.status === 'rejected'
      );
      if (errors.length)
        setError(
          errors
            .map(result =>
              result.status === 'rejected'
                ? String(result.reason?.message || 'Could not load data. Please refresh.')
                : ''
            )
            .join(' ')
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isDmc]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [report?.id, history]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    let active = true;
    setAudit([]);
    if (report)
      void getDonorDistributionHistory(report.id)
        .then(rows => {
          if (active) setAudit(rows);
        })
        .catch(e => {
          if (active) setError((e as Error).message);
        });
    return () => {
      active = false;
    };
  }, [report?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function action(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message || 'Could not complete this action. Please retry.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const generate = () =>
    action(async () => {
      if (!event || !state.user) throw new Error('Select a closed hazard event first.');
      const result = await generatePostEventReport(
        event,
        {
          selectedMetrics: selected,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
          district,
        },
        state.user.id
      );
      setReport(result);
      setSaved(rows => [result, ...rows]);
      setMessage('Response report generated and saved.');
    });
  const download = (format: ExportFormat) =>
    action(async () => {
      if (!report) return;
      const result = await exportReport(report.id, format);
      setReport({ ...report, exportUrl: result.exportUrl, exportFormat: format });
      setSaved(rows =>
        rows.map(item =>
          item.id === report.id
            ? { ...item, exportUrl: result.exportUrl, exportFormat: format }
            : item
        )
      );
      await saveReportFile(result.artifact);
      setMessage('Export file ready. On mobile, choose where to save or share it.');
    });
  const m = report?.metrics;
  return (
    <ScreenContainer style={officerScreenStyle} contentStyle={officerShellStyle}>
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 105 + insets.bottom }}
      >
        <ReportScreenHero
          title="Post-event reports"
          caption="Response analysis"
          icon="stats-chart-outline"
          description="Review a completed event, understand the response and share the results."
          onBack={() => router.push('/(app)')}
        />
        <View style={styles.content}>
          {!isDmc ? (
            <View style={styles.card}>
              <Text style={styles.title}>DMC officers only</Text>
              <Text style={styles.body}>
                Sign in with a DMC officer account to generate response reports.
              </Text>
              <OfficerButton title="Return home" onPress={() => router.push('/(app)')} />
            </View>
          ) : (
            <>
              <View style={styles.tabs}>
                {['New report', 'Saved reports'].map((label, i) => (
                  <TouchableOpacity
                    key={label}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityState={{ selected: history === Boolean(i) }}
                    style={[styles.tab, history === Boolean(i) && styles.selected]}
                    onPress={() => {
                      setHistory(Boolean(i));
                      setReport(null);
                      setSharing(false);
                      setError('');
                    }}
                  >
                    <Text style={history === Boolean(i) ? styles.link : styles.caption}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {!!error && (
                <View accessibilityRole="alert" style={styles.error}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              {!!message && (
                <View accessibilityRole="alert" style={styles.success}>
                  <Text style={styles.body}>{message}</Text>
                </View>
              )}
              {loading ? (
                <ActivityIndicator color={LightColors.primary} />
              ) : report ? (
                <>
                  <View style={styles.card}>
                    <Text style={styles.eyebrow}>RESPONSE REPORT</Text>
                    <Text style={styles.title}>{report.eventTitle}</Text>
                    <Text style={styles.caption}>
                      {new Date(report.generatedAt).toLocaleString()} |{' '}
                      {report.filterCriteria.district || 'All districts'}
                    </Text>
                    <Text style={styles.caption}>
                      {report.filterCriteria.startDate || 'Beginning of records'} to{' '}
                      {report.filterCriteria.endDate || 'Latest records'}
                    </Text>
                    <Text style={styles.bold}>
                      {report.overallStatus === 'PARTIAL_SUCCESS'
                        ? 'Some metrics could not be loaded'
                        : 'Report complete'}
                    </Text>
                    <OfficerButton
                      variant="outline"
                      title={history ? 'Back to saved reports' : 'Change filters'}
                      disabled={busy}
                      onPress={() => {
                        setReport(null);
                        setSharing(false);
                      }}
                    />
                  </View>
                  {history && (
                    <OfficerButton
                      title="Use these filters for a new report"
                      variant="outline"
                      disabled={busy}
                      onPress={refineReport}
                    />
                  )}
                  {!!report.failedMetrics.length && (
                    <View style={styles.error}>
                      <Text style={styles.errorText}>
                        Incomplete metrics:{' '}
                        {report.failedMetrics
                          .map(key => REPORT_METRICS.find(m => m.value === key)?.label || key)
                          .join(', ')}
                        . Return to the filters and retry generation.
                      </Text>
                    </View>
                  )}
                  {m?.alerts && typeof m.alerts !== 'string' && (
                    <View style={styles.card}>
                      <Text style={styles.title}>Alert timeline</Text>
                      <Text style={styles.body}>
                        {m.alerts.totalAlertsIssued} warnings | {m.alerts.escalationCount} follow-up
                        warnings
                      </Text>
                      <BarRows
                        rows={Object.entries(m.alerts.warningsBySeverity).map(([label, value]) => ({
                          label,
                          value,
                        }))}
                        unit="warnings"
                      />
                      {m.alerts.timeline.map((entry, i) => (
                        <View key={i} style={styles.tableRow}>
                          <Text style={styles.eyebrow}>{entry.level.toUpperCase()}</Text>
                          <Text style={styles.bold}>{entry.message}</Text>
                          <Text style={styles.caption}>
                            {new Date(entry.timestamp).toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {m?.citizenReach && typeof m.citizenReach !== 'string' && (
                    <View style={styles.card}>
                      <Text style={styles.title}>Citizens reached</Text>
                      <Text style={styles.big}>
                        {m.citizenReach.totalCitizensReached.toLocaleString()}
                      </Text>
                      <Text style={styles.body}>Estimated recipient exposures</Text>
                      <BarRows
                        rows={[
                          {
                            label: 'Channel delivery rate',
                            value: m.citizenReach.notificationDeliveryRate,
                          },
                        ]}
                        unit="%"
                      />
                      <Text style={styles.caption}>{m.citizenReach.measurementNote}</Text>
                    </View>
                  )}
                  {m?.shelterOccupancy && typeof m.shelterOccupancy !== 'string' && (
                    <View style={styles.card}>
                      <Text style={styles.title}>Shelter occupancy</Text>
                      <Text style={styles.body}>
                        {m.shelterOccupancy.totalSheltersActive} shelters with recorded headcounts
                      </Text>
                      <Text style={styles.bold}>
                        Peak recorded: {m.shelterOccupancy.totalCapacitiesOccupied} people (
                        {m.shelterOccupancy.peakOccupancyPercentage}%)
                      </Text>
                      <BarRows
                        rows={m.shelterOccupancy.timeSeriesOccupancy.map(p => ({
                          label: p.date,
                          value: p.occupancyCount,
                        }))}
                        unit="people"
                      />
                      <Text style={styles.caption}>
                        Daily closing recorded headcounts; no readings are invented for missing
                        days. Historical records without an event tag use the shelter&apos;s current
                        event association.
                      </Text>
                    </View>
                  )}
                  {m?.resourceDistribution && typeof m.resourceDistribution !== 'string' && (
                    <View style={styles.card}>
                      <Text style={styles.title}>Resource distribution</Text>
                      <Text style={styles.caption}>
                        Quantities keep their recorded units. Different units are not combined into
                        a single total.
                      </Text>
                      {Object.entries(m.resourceDistribution.distributionByDistrict).map(
                        ([area, group]) => (
                          <View style={styles.gap} key={area}>
                            <Text style={styles.bold}>{area}</Text>
                            {group.items?.map((item, i) => (
                              <View key={i} style={styles.tableRow}>
                                <Text style={styles.body}>{item.name}</Text>
                                <Text style={styles.bold}>
                                  {item.quantity.toLocaleString()} {item.unit}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )
                      )}
                      {!Object.keys(m.resourceDistribution.distributionByDistrict).length && (
                        <Text style={styles.caption}>
                          No distribution records match these filters.
                        </Text>
                      )}
                    </View>
                  )}
                  <View style={styles.card}>
                    <Text style={styles.title}>Export report</Text>
                    <Text style={styles.body}>
                      Save a PDF document or a CSV dataset. Your export stays linked to this report.
                    </Text>
                    <OfficerButton
                      title="Export PDF"
                      loading={busy}
                      onPress={() => void download('pdf')}
                    />
                    <OfficerButton
                      title="Export CSV"
                      variant="outline"
                      disabled={busy}
                      onPress={() => void download('csv')}
                    />
                    {report.exportFormat && (
                      <OfficerButton
                        title="Share with donor"
                        variant="outline"
                        disabled={
                          busy ||
                          report.overallStatus !== 'COMPLETE' ||
                          !!report.failedMetrics.length
                        }
                        onPress={() => setSharing(true)}
                      />
                    )}
                    {report.overallStatus !== 'COMPLETE' && (
                      <Text style={styles.errorText}>
                        Regenerate the incomplete metrics before sharing this report with a donor.
                      </Text>
                    )}
                  </View>
                  {sharing && (
                    <View style={styles.card}>
                      <Text style={styles.title}>Share with a donor</Text>
                      <Text style={styles.body}>
                        Download the exported file, attach it in your email app and send it to the
                        selected organisation. Then record that you shared it.
                      </Text>
                      <Select
                        appearance="light"
                        label="Registered organisation"
                        value={donorId}
                        options={donors.map(d => ({
                          value: d.id,
                          label: d.name,
                          description: d.email,
                        }))}
                        onValueChange={setDonorId}
                        footerAction={{
                          label: 'Register donor organisation',
                          onPress: () => setDonorModal(true),
                        }}
                      />
                      {donor && <Text style={styles.caption}>{donor.email}</Text>}
                      <OfficerButton
                        title="Download exported file"
                        disabled={busy}
                        variant="outline"
                        onPress={() =>
                          void action(async () => {
                            await saveReportFile(
                              await getReportExport(report.id, report.exportFormat!)
                            );
                          })
                        }
                      />
                      <OfficerButton
                        title="Open email to donor"
                        disabled={
                          !donor ||
                          busy ||
                          report.overallStatus !== 'COMPLETE' ||
                          !!report.failedMetrics.length
                        }
                        variant="outline"
                        onPress={() =>
                          void action(async () => {
                            await Linking.openURL(
                              `mailto:${donor!.email}?subject=${encodeURIComponent('DisasterGuard response report: ' + report.eventTitle)}&body=${encodeURIComponent('Please find the attached post-event response report.\n\nAttach the downloaded report file before sending.')}`
                            );
                          })
                        }
                      />
                      <OfficerButton
                        title="Record that I shared this report"
                        disabled={!donor || busy}
                        onPress={() =>
                          void action(async () => {
                            const record = await distributeReportToDonor(
                              report.id,
                              report.eventId,
                              donorId,
                              donor!.name,
                              report.exportFormat!,
                              report.exportUrl!,
                              state.user!.id
                            );
                            setAudit(rows => [record, ...rows]);
                            setSharing(false);
                            setMessage(
                              'Sharing details recorded. Recipient delivery is not automatically confirmed.'
                            );
                          })
                        }
                      />
                      <Text style={styles.caption}>
                        The app records your confirmation; it does not claim email delivery.
                      </Text>
                    </View>
                  )}
                  {!!audit.length && (
                    <View style={styles.card}>
                      <Text style={styles.title}>Sharing history</Text>
                      {audit.map(item => (
                        <View key={item.id} style={styles.tableRow}>
                          <Text style={styles.bold}>{item.donorName}</Text>
                          <Text style={styles.caption}>
                            {item.format.toUpperCase()} |{' '}
                            {new Date(item.distributedAt).toLocaleString()} |{' '}
                            {item.status === 'SHARED' ? 'Officer confirmed sharing' : item.status}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : history ? (
                <View style={styles.gap}>
                  <Text style={styles.title}>Saved response reports</Text>
                  {!saved.length && (
                    <View style={styles.card}>
                      <Text style={styles.body}>
                        No response reports yet. Generate one from a closed event.
                      </Text>
                    </View>
                  )}
                  {saved.map(item => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={item.id}
                      style={styles.card}
                      onPress={() => setReport(item)}
                    >
                      <Text style={styles.title}>{item.eventTitle}</Text>
                      <Text style={styles.caption}>
                        {new Date(item.generatedAt).toLocaleString()} |{' '}
                        {item.filterCriteria.district || 'All districts'}
                      </Text>
                      <Text style={styles.link}>View response report</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <>
                  <View style={styles.card}>
                    <Text style={styles.eyebrow}>STEP 1 OF 2</Text>
                    <Text style={styles.title}>Choose a completed event</Text>
                    {events.length ? (
                      <Select
                        appearance="light"
                        label="Closed hazard event"
                        value={eventId}
                        placeholder="Select an event"
                        options={events.map(e => ({
                          value: e.id,
                          label: e.title,
                          description: `${e.affectedDistricts.join(', ')} | ${e.startDate.slice(0, 10)} to ${e.closedAt ? new Date(e.closedAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo' }) : 'Closure date not recorded'}`,
                        }))}
                        onValueChange={id => {
                          setEventId(id);
                          setDistrict('all');
                          setStart('');
                          setEnd('');
                        }}
                      />
                    ) : (
                      <>
                        <Text style={styles.body}>
                          No closed events available. Close a resolved event in Hazard events before
                          generating a report.
                        </Text>
                        <OfficerButton
                          title="Go to hazard events"
                          onPress={() => router.push('/(app)/warnings/events')}
                        />
                      </>
                    )}
                  </View>
                  {event && (
                    <>
                      <View style={styles.card}>
                        <Text style={styles.eyebrow}>STEP 2 OF 2</Text>
                        <Text style={styles.title}>Configure your report</Text>
                        <Text style={styles.body}>Select the metrics you need.</Text>
                        {REPORT_METRICS.map(metric => {
                          const checked = selected.includes(metric.value);
                          return (
                            <TouchableOpacity
                              key={metric.value}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked }}
                              style={[styles.metricOption, checked && styles.selected]}
                              onPress={() =>
                                setSelected(current =>
                                  checked
                                    ? current.filter(m => m !== metric.value)
                                    : [...current, metric.value]
                                )
                              }
                            >
                              <Ionicons
                                name={checked ? 'checkbox' : 'square-outline'}
                                size={24}
                                color={checked ? LightColors.primary : LightColors.secondaryText}
                              />
                              <View style={styles.flex}>
                                <Text style={styles.bold}>{metric.label}</Text>
                                <Text style={styles.caption}>{metric.description}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                        <ReportDatePicker
                          label="Start date (optional)"
                          value={startDate}
                          onChange={setStart}
                        />
                        <ReportDatePicker
                          label="End date (optional)"
                          value={endDate}
                          onChange={setEnd}
                        />
                        <Select
                          appearance="light"
                          label="District"
                          value={district}
                          onValueChange={setDistrict}
                          options={[
                            { value: 'all', label: 'All affected districts' },
                            ...event.affectedDistricts.map(d => ({ value: d, label: d })),
                          ]}
                        />
                        <Text style={styles.caption}>
                          Leave dates empty to include all available records. Missing data is shown
                          explicitly.
                        </Text>
                        <OfficerButton
                          title="Generate response report"
                          loading={busy}
                          onPress={() => void generate()}
                        />
                      </View>
                    </>
                  )}
                </>
              )}
              {!loading && !report && (
                <OfficerButton
                  title="Refresh events and reports"
                  variant="outline"
                  onPress={() => void load()}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>
      <MobileNavBar appearance="light" />
      <FormModal
        appearance="light"
        visible={donorModal}
        title="Register donor organisation"
        feedbackKey={donorFeedback.attempt}
        onClose={() => {
          if (!busy) setDonorModal(false);
        }}
      >
        <View style={styles.gap}>
          <Text style={styles.body}>
            Add the organisation and its contact email to share saved reports.
          </Text>
          <Input
            appearance="light"
            label="Organisation name"
            error={donorFeedback.errors.name}
            value={donorName}
            onChangeText={setDonorName}
          />
          <Input
            appearance="light"
            label="Email"
            error={donorFeedback.errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            value={donorEmail}
            onChangeText={setDonorEmail}
          />
          <FormError message={donorFeedback.error} />
          <OfficerButton
            title="Register organisation"
            loading={busy}
            onPress={() => {
              const errors = requiredFields(
                { name: donorName, email: donorEmail },
                { name: 'Organisation name', email: 'Email' }
              );
              if (donorEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail.trim()))
                errors.email = 'Enter a valid email address.';
              donorFeedback.setErrors(errors);
              if (Object.keys(errors).length) return;
              void action(async () => {
                try {
                  const item = await registerDonor(donorName, donorEmail);
                  setDonors(rows => [...rows, item]);
                  setDonorId(item.id);
                  setDonorModal(false);
                  setDonorName('');
                  setDonorEmail('');
                } catch (err) {
                  donorFeedback.setError(
                    (err as Error).message ||
                      'Could not register the organisation. Please try again.'
                  );
                }
              });
            }}
          />
        </View>
      </FormModal>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  content: { padding: 18, gap: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LightColors.border,
    padding: 18,
    gap: 12,
    shadowColor: '#183A65',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  title: { ...MobileTypography.section, fontWeight: '700', color: LightColors.text },
  body: { ...MobileTypography.body, color: LightColors.secondaryText },
  caption: { ...MobileTypography.caption, color: LightColors.secondaryText },
  bold: { fontSize: 14, lineHeight: 21, fontWeight: '700', color: LightColors.text },
  big: { fontSize: 32, fontWeight: '800', color: LightColors.primary },
  eyebrow: { fontSize: 12, lineHeight: 18, fontWeight: '800', color: LightColors.primary },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  gap: { gap: 12 },
  gapSmall: { gap: 6 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    minHeight: 44,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  selected: { borderColor: LightColors.primary, backgroundColor: LightColors.primarySoft },
  link: { color: LightColors.primary, fontWeight: '700', fontSize: 14 },
  metricOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 14,
  },
  error: { padding: 14, backgroundColor: LightColors.dangerSoft, borderRadius: 14 },
  errorText: { fontSize: 14, lineHeight: 21, color: LightColors.danger },
  success: { padding: 14, backgroundColor: '#E5F7ED', borderRadius: 14 },
  tableRow: { paddingVertical: 12, borderTopWidth: 1, borderColor: LightColors.border, gap: 5 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: LightColors.primarySoft,
    overflow: 'hidden',
  },
  bar: { height: 8, borderRadius: 4, backgroundColor: LightColors.primary },
});
import { useFormFeedback } from '@/hooks/useFormFeedback';
import { requiredFields } from '@/utils/formValidation';
import { FormError } from './FormError';
