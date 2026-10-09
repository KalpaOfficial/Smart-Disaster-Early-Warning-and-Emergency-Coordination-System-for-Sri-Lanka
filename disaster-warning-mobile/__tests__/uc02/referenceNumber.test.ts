import { generateReferenceNumber } from '@/services/groundReportService';

describe('UC02: Ground Report Reference Number Generation', () => {
  it('generates a reference number matching the official format GR-YYYYMMDD-XXXX', () => {
    const ref = generateReferenceNumber();
    const regex = /^GR-\d{8}-\d{4}$/;
    expect(ref).toMatch(regex);
  });

  it('embeds the current UTC date into the reference number', () => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ref = generateReferenceNumber();
    expect(ref).toContain(`GR-${todayStr}-`);
  });

  it('generates unique reference numbers across rapid successive calls', () => {
    const generated = new Set<string>();
    const count = 100;
    for (let i = 0; i < count; i++) {
      generated.add(generateReferenceNumber());
    }
    // High entropy across rapid successive calls (allowing for birthday paradox on 4-digit range)
    expect(generated.size).toBeGreaterThanOrEqual(95);
  });
});
