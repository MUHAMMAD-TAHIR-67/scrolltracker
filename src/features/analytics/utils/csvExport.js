// SDK 54 replaced expo-file-system's default export with a new class-based
// API (File/Directory/Paths). The function-based API this file uses
// (writeAsStringAsync, cacheDirectory, EncodingType) still ships, officially
// supported, at the /legacy subpath.
// ponytail: staying on the legacy API is the smaller diff and it's an
// Expo-maintained compatibility path, not a hack - but it's marked
// deprecated upstream, so if a future SDK removes it, migrate to
// `File`/`Paths` (docs.expo.dev/versions/latest/sdk/filesystem).
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { format } from "date-fns";
import { trackingRepository } from "@/features/tracking/repository/TrackingRepository";

function toCsvValue(value) {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => toCsvValue(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

/**
 * Exports every closed session as a CSV file to the app's cache directory,
 * then opens the native share sheet so the user can save it to Drive,
 * email it, etc. No data ever leaves the device unless the user explicitly
 * shares it from here.
 * @returns {Promise<string>} the file URI written
 */
export async function exportSessionsCsv() {
  const rawRows = await trackingRepository.exportAllSessionsAsRows();

  const formattedRows = rawRows.map((r) => ({
    date: r.day_bucket,
    platform: r.platform,
    started_at: format(new Date(Number(r.started_at)), "yyyy-MM-dd HH:mm:ss"),
    ended_at: r.ended_at ? format(new Date(Number(r.ended_at)), "yyyy-MM-dd HH:mm:ss") : "",
    duration_seconds: r.duration_ms ? Math.round(Number(r.duration_ms) / 1000) : 0,
    video_count: r.video_count,
    source: r.source,
  }));

  const csv = rowsToCsv(formattedRows);
  const fileName = `scrolltracker-export-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
  const fileUri = FileSystem.cacheDirectory + fileName;

  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "text/csv",
      dialogTitle: "Export ScrollTracker data",
      UTI: "public.comma-separated-values-text",
    });
  }

  return fileUri;
}
