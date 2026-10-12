import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ReportDetailView } from '@/components/ReportDetailView';

export default function ReportDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  return <ReportDetailView reportId={reportId} />;
}
