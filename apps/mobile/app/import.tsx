import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, DataTable, HelperText, List, Text, useTheme } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { API_URL } from '@/lib/config';
import { tokenStorage } from '@/lib/storage';
import { formatMinor } from '@/lib/format';
import type { AppColors } from '@/theme';

interface PreviewRow {
  row: number;
  type: 'expense' | 'income' | 'transfer';
  date: string;
  amountMinor: number;
  account: string;
  category?: string;
  subcategory?: string;
  memo?: string;
}
interface ImportStats {
  parsed: number;
  errors: number;
  inserted: number;
  skippedDuplicates: number;
  accountsCreated: string[];
  categoriesCreated: string[];
}
interface DryRunResult {
  dryRun: true;
  stats: ImportStats;
  errors: { row: number; message: string }[];
  preview: PreviewRow[];
  headers: string[];
}
interface ApplyResult {
  dryRun: false;
  stats: ImportStats;
  errors: { row: number; message: string }[];
}

export default function ImportScreen() {
  const theme = useTheme();
  const colors = theme.colors as AppColors;
  const [file, setFile] = useState<{ name: string; uri: string; file?: File } | null>(null);
  const [preview, setPreview] = useState<DryRunResult | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setFile({ name: a.name, uri: a.uri, file: a.file });
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const upload = async (dryRun: boolean): Promise<DryRunResult | ApplyResult> => {
    const form = new FormData();
    if (Platform.OS === 'web' && file!.file) {
      form.append('file', file!.file, file!.name);
    } else {
      form.append('file', { uri: file!.uri, name: file!.name, type: 'application/octet-stream' } as unknown as Blob);
    }
    const res = await fetch(`${API_URL}/api/import/realbyte${dryRun ? '?dryRun=1' : ''}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await tokenStorage.get('mm.accessToken')}` },
      body: form,
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json as DryRunResult | ApplyResult;
  };

  const dryRun = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview((await upload(true)) as DryRunResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult((await upload(false)) as ApplyResult);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const colorFor = (t: string) => (t === 'expense' ? colors.expense : t === 'income' ? colors.income : colors.transfer);

  return (
    <ScrollView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.card} mode="contained">
        <Card.Content>
          <Text variant="titleMedium">Import from Money Manager (Realbyte)</Text>
          <Text variant="bodySmall" style={styles.hint}>
            In Realbyte: Settings → Export data to Excel. Upload the .xlsx/.xls/.csv here — columns
            Date, Account, Category, Subcategory, Note, Amount, Income/Expense, Description are
            detected automatically. Missing accounts & categories are created for you.
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.row}>
        <Button mode="outlined" onPress={pick} icon="file-upload-outline">
          {file ? file.name : 'Choose file'}
        </Button>
        {file && !preview && !result && (
          <Button mode="contained" onPress={dryRun} loading={busy}>
            Preview
          </Button>
        )}
      </View>

      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>

      {preview && (
        <View>
          <List.Subheader>
            {preview.stats.parsed} rows parsed
            {preview.stats.errors > 0 ? ` · ${preview.stats.errors} errors` : ''}
          </List.Subheader>
          {preview.errors.map((e) => (
            <HelperText key={e.row} type="error" visible>
              Row {e.row}: {e.message}
            </HelperText>
          ))}
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Date</DataTable.Title>
              <DataTable.Title>Type</DataTable.Title>
              <DataTable.Title>Account</DataTable.Title>
              <DataTable.Title>Category</DataTable.Title>
              <DataTable.Title numeric>Amount</DataTable.Title>
            </DataTable.Header>
            {preview.preview.map((r) => (
              <DataTable.Row key={r.row}>
                <DataTable.Cell>{r.date}</DataTable.Cell>
                <DataTable.Cell>{r.type}</DataTable.Cell>
                <DataTable.Cell>{r.account}</DataTable.Cell>
                <DataTable.Cell>{r.category ?? '—'}</DataTable.Cell>
                <DataTable.Cell numeric>
                  <Text style={{ color: colorFor(r.type) }}>{formatMinor(r.amountMinor)}</Text>
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
          {preview.stats.parsed > preview.preview.length && (
            <Text style={styles.hint}>…and {preview.stats.parsed - preview.preview.length} more</Text>
          )}
          <Button
            mode="contained"
            onPress={apply}
            loading={busy}
            disabled={preview.stats.parsed === 0}
            style={styles.applyBtn}
          >
            Import {preview.stats.parsed} rows
          </Button>
        </View>
      )}

      {result && (
        <Card style={styles.card} mode="contained">
          <Card.Content>
            <Text variant="titleMedium">Import complete</Text>
            <Text variant="bodyMedium" style={{ marginTop: 8 }}>
              {result.stats.inserted} inserted
              {result.stats.skippedDuplicates > 0
                ? ` · ${result.stats.skippedDuplicates} duplicates skipped`
                : ''}
            </Text>
            {result.stats.accountsCreated.length > 0 && (
              <Text variant="bodySmall" style={styles.hint}>
                Accounts created: {result.stats.accountsCreated.join(', ')}
              </Text>
            )}
            {result.stats.categoriesCreated.length > 0 && (
              <Text variant="bodySmall" style={styles.hint}>
                Categories created: {result.stats.categoriesCreated.join(', ')}
              </Text>
            )}
          </Card.Content>
        </Card>
      )}
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { margin: 12 },
  hint: { opacity: 0.6, marginTop: 8, paddingHorizontal: 16 },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, alignItems: 'center' },
  applyBtn: { margin: 16 },
});
