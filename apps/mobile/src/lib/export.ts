import { Platform } from 'react-native';
import { API_URL } from './config';
import { tokenStorage } from './storage';

/** Download transactions CSV. Web: blob + anchor download. Native: share sheet. */
export async function exportTransactionsCsv(): Promise<void> {
  const token = await tokenStorage.get('mm.accessToken');
  const res = await fetch(`${API_URL}/api/transactions/export.csv`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const csv = await res.text();

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `money-manager-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const path = `${FileSystem.cacheDirectory}money-manager.csv`;
  await FileSystem.writeAsStringAsync(path, csv);
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export transactions' });
}
