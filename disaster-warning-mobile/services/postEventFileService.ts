import { Platform } from 'react-native';
import type { ReportExportArtifact } from '@/types/postEventReport';

export async function saveReportFile(artifact: ReportExportArtifact): Promise<void> {
  if (Platform.OS === 'web') {
    const binary = atob(artifact.base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: artifact.mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('File sharing is unavailable on this device.');
  const file = new File(Paths.cache, artifact.fileName);
  file.create({ overwrite: true });
  file.write(Uint8Array.from(atob(artifact.base64), c => c.charCodeAt(0)));
  await Sharing.shareAsync(file.uri, {
    mimeType: artifact.mimeType,
    dialogTitle: 'Save or share response report',
  });
}
