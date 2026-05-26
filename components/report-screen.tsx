import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    UIManager,
    View,
    useWindowDimensions,
} from "react-native";

import { Colors } from "../constants/theme";
import { auth } from "../firebaseConfig";
import { useScreenDataCache } from "../hooks/use-screen-data-cache";
import { useThemeContext } from "../hooks/use-theme-context";
import { calculateAdherence } from "../services/analytics";
import { getLogsByDateRange } from "../services/firebaseService";
import { DatePickerModal } from "./date-picker-modal";
import { DecorativeBackground } from "./decorative-background";

type Log = {
  id: string;
  medicineName: string;
  dosage?: string;
  time: string;
  status: "taken" | "missed" | "pending" | string;
  date: string;
};

type FilterOption =
  | "This Week"
  | "This Month"
  | "Last 30 Days"
  | "Custom Range";
type RangePickerTarget = "start" | "end" | null;
type ChartMode = "daily" | "weekly";

type Range = { start: Date; end: Date };
type ThemeColors = (typeof Colors)[keyof typeof Colors];

const FILTER_OPTIONS: FilterOption[] = [
  "This Week",
  "This Month",
  "Last 30 Days",
  "Custom Range",
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CUREMATE_LOGO = require("../assets/images/CureMate_logo.png");
const LegacyFileSystem = FileSystem as any;

const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalIsoDate = (value: string) => new Date(`${value}T00:00:00`);

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const addMonths = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};

const startOfWeek = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  const diff = next.getDate() - day + (day === 0 ? -6 : 1);
  next.setDate(diff);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfWeek = (date: Date) => {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
};

const startOfMonth = (date: Date) => {
  const next = new Date(date.getFullYear(), date.getMonth(), 1);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfMonth = (date: Date) => {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  next.setHours(23, 59, 59, 999);
  return next;
};

const daysBetweenInclusive = (start: Date, end: Date) =>
  Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatLongDateLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const formatTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;

  const hour24 = Number.parseInt(match[1], 10);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${minute} ${period}`;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getUserLabel = () =>
  auth.currentUser?.displayName ||
  auth.currentUser?.email?.split("@")[0] ||
  "CureMate patient";

const getFilterRange = (filter: FilterOption, customRange: Range) => {
  const today = new Date();

  if (filter === "This Week") {
    return { start: startOfWeek(today), end: endOfWeek(today) };
  }

  if (filter === "This Month") {
    return { start: startOfMonth(today), end: endOfMonth(today) };
  }

  if (filter === "Last 30 Days") {
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const start = addDays(today, -29);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  return customRange;
};

const getRangeKey = (filter: FilterOption, range: Range) =>
  `${filter}:${toLocalIsoDate(range.start)}:${toLocalIsoDate(range.end)}`;

const buildChartSeries = (logs: Log[], range: Range, mode: ChartMode) => {
  if (mode === "daily") {
    const items: Array<{
      label: string;
      subtitle: string;
      taken: number;
      missed: number;
    }> = [];

    const cursor = new Date(range.start);
    while (cursor <= range.end) {
      const iso = toLocalIsoDate(cursor);
      const dayLogs = logs.filter((log) => log.date === iso);
      items.push({
        label: cursor.toLocaleDateString("en-US", { weekday: "short" }),
        subtitle: cursor.toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
        }),
        taken: dayLogs.filter((log) => log.status === "taken").length,
        missed: dayLogs.filter((log) => log.status === "missed").length,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return items;
  }

  const items: Array<{
    label: string;
    subtitle: string;
    taken: number;
    missed: number;
  }> = [];

  let cursor = new Date(range.start);
  let weekIndex = 1;

  while (cursor <= range.end) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(
      Math.min(addDays(weekStart, 6).getTime(), range.end.getTime()),
    );
    const weekLogs = logs.filter((log) => {
      const current = parseLocalIsoDate(log.date);
      return current >= weekStart && current <= weekEnd;
    });

    items.push({
      label: `Week ${weekIndex}`,
      subtitle: `${formatDateLabel(weekStart)} - ${formatDateLabel(weekEnd)}`,
      taken: weekLogs.filter((log) => log.status === "taken").length,
      missed: weekLogs.filter((log) => log.status === "missed").length,
    });

    cursor = addDays(weekEnd, 1);
    weekIndex += 1;
  }

  return items;
};

const buildPdfHtml = (payload: {
  userLabel: string;
  rangeLabel: string;
  startLabel: string;
  endLabel: string;
  adherence: number;
  takenCount: number;
  missedCount: number;
  totalCount: number;
  logs: Log[];
}) => {
  const rows = payload.logs.length
    ? payload.logs
        .map(
          (log, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(log.date)}</td>
              <td>${escapeHtml(formatTime(log.time))}</td>
              <td>${escapeHtml(log.medicineName || "-")}</td>
              <td>${escapeHtml(log.dosage || "-")}</td>
              <td>${escapeHtml(log.status)}</td>
            </tr>
          `,
        )
        .join("")
    : `
      <tr>
        <td colspan="6" style="text-align:center;padding:18px 10px;color:#6B7280;">
          No report data available for this range.
        </td>
      </tr>
    `;

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            padding: 28px;
            color: #1f2937;
            background: #f7f8fc;
          }
          .sheet {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            padding: 24px;
          }
          .top {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 26px;
            font-weight: 800;
            color: #5d49cf;
            margin-bottom: 4px;
          }
          .subtle {
            color: #6b7280;
            font-size: 12px;
            line-height: 1.5;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin: 20px 0;
          }
          .card {
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 14px;
            background: #fafbff;
          }
          .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; }
          .value { font-size: 22px; font-weight: 800; margin-top: 6px; color: #111827; }
          .section-title { font-size: 16px; font-weight: 800; margin: 18px 0 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; font-size: 12px; }
          th { background: #f4f0ff; color: #5d49cf; font-weight: 800; }
          tr:nth-child(even) td { background: #fcfcfe; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="top">
            <div>
              <div class="title">CureMate Report</div>
              <div class="subtle">Patient: ${escapeHtml(payload.userLabel)}</div>
              <div class="subtle">Range: ${escapeHtml(payload.rangeLabel)} (${escapeHtml(payload.startLabel)} - ${escapeHtml(payload.endLabel)})</div>
            </div>
            <div class="subtle" style="text-align:right;">
              Generated on ${escapeHtml(new Date().toLocaleString())}
            </div>
          </div>

          <div class="summary">
            <div class="card"><div class="label">Adherence</div><div class="value">${payload.adherence}%</div></div>
            <div class="card"><div class="label">Taken</div><div class="value">${payload.takenCount}</div></div>
            <div class="card"><div class="label">Missed</div><div class="value">${payload.missedCount}</div></div>
            <div class="card"><div class="label">Total schedules</div><div class="value">${payload.totalCount}</div></div>
          </div>

          <div class="section-title">Detailed medicine logs</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Time</th>
                <th>Medicine</th>
                <th>Dosage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
};

const buildPdfFileName = (range: Range) =>
  `CureMate_Report_${toLocalIsoDate(range.start)}_to_${toLocalIsoDate(range.end)}.pdf`;

const savePdfToDevice = async (pdfUri: string, fileName: string) => {
  const base64 = await LegacyFileSystem.readAsStringAsync(pdfUri, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });

  if (Platform.OS === "android") {
    const permission =
      await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

    if (permission.granted && permission.directoryUri) {
      const destinationUri =
        await LegacyFileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          fileName,
          "application/pdf",
        );

      await LegacyFileSystem.writeAsStringAsync(destinationUri, base64, {
        encoding: LegacyFileSystem.EncodingType.Base64,
      });

      return destinationUri;
    }
  }

  const fallbackUri = `${LegacyFileSystem.documentDirectory ?? ""}${fileName}`;
  await LegacyFileSystem.writeAsStringAsync(fallbackUri, base64, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });

  return fallbackUri;
};

const downloadPdfOnWeb = async (payload: {
  userLabel: string;
  rangeLabel: string;
  startLabel: string;
  endLabel: string;
  adherence: number;
  takenCount: number;
  missedCount: number;
  totalCount: number;
  logs: Log[];
  fileName: string;
}) => {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  const sanitize = (value: string) =>
    String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^ -]/g, "?");

  const truncate = (value: string, maxChars: number) => {
    if (value.length <= maxChars) return value;
    return `${value.slice(0, Math.max(0, maxChars - 1))}...`;
  };

  const rows = payload.logs.map((log, index) => [
    String(index + 1),
    log.date,
    formatTime(log.time),
    log.medicineName || "-",
    log.dosage || "-",
    log.status,
  ]);

  const rowsPerFirstPage = 18;
  const rowsPerNextPage = 26;
  const rowGroups: string[][][] = [];

  if (rows.length === 0) {
    rowGroups.push([
      ["", "", "", "No report data available for this range.", "", ""],
    ]);
  } else {
    rowGroups.push(rows.slice(0, rowsPerFirstPage));
    for (
      let index = rowsPerFirstPage;
      index < rows.length;
      index += rowsPerNextPage
    ) {
      rowGroups.push(rows.slice(index, index + rowsPerNextPage));
    }
  }

  const columnDefs = [
    { label: "#", width: 24 },
    { label: "Date", width: 88 },
    { label: "Time", width: 60 },
    { label: "Medicine", width: 168 },
    { label: "Dosage", width: 96 },
    { label: "Status", width: 87 },
  ];

  let logoAsset: {
    hexData: string;
    width: number;
    height: number;
  } | null = null;

  const logoModule = Asset.fromModule(CUREMATE_LOGO);
  if (!logoModule.localUri && !logoModule.uri) {
    try {
      await logoModule.downloadAsync();
    } catch {
      // Keep fallback header placeholder if download fails.
    }
  }
  const logoUri = logoModule.localUri ?? logoModule.uri;
  if (logoUri && typeof document !== "undefined") {
    try {
      const logoImage = await new Promise<HTMLImageElement>(
        (resolve, reject) => {
          const img = new window.Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = logoUri;
        },
      );

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context) {
        const maxWidth = 180;
        const maxHeight = 140;
        const ratio = Math.min(
          maxWidth / logoImage.width,
          maxHeight / logoImage.height,
          1,
        );

        const width = Math.max(1, Math.round(logoImage.width * ratio));
        const height = Math.max(1, Math.round(logoImage.height * ratio));

        canvas.width = width;
        canvas.height = height;
        context.drawImage(logoImage, 0, 0, width, height);

        const logoDataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const base64 = logoDataUrl.split(",")[1] ?? "";
        const binary = atob(base64);
        let hexData = "";
        for (let index = 0; index < binary.length; index += 1) {
          hexData += binary.charCodeAt(index).toString(16).padStart(2, "0");
        }

        if (hexData.length > 0) {
          logoAsset = {
            hexData,
            width,
            height,
          };
        }
      }
    } catch (error) {
      console.warn("Unable to embed logo in web PDF", error);
    }
  }

  const buildPageContent = (rowsForPage: string[][], pageIndex: number) => {
    const cmds: string[] = [];

    const text = (
      x: number,
      y: number,
      value: string,
      size = 10,
      bold = false,
      color = "0.12 0.16 0.23",
    ) => {
      const font = bold ? "/F2" : "/F1";
      cmds.push(
        `BT ${color} rg ${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${sanitize(value)}) Tj ET`,
      );
    };

    const rect = (
      x: number,
      y: number,
      w: number,
      h: number,
      fill: string,
      stroke?: string,
    ) => {
      cmds.push(
        `q ${fill} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f Q`,
      );
      if (stroke) {
        cmds.push(
          `q ${stroke} RG ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S Q`,
        );
      }
    };

    const headerHeight = 96;
    const headerTop = pageHeight - margin;
    rect(
      margin,
      headerTop - headerHeight,
      contentWidth,
      headerHeight,
      "0.36 0.29 0.81",
    );

    text(margin + 14, headerTop - 30, "CureMate Report", 24, true, "1 1 1");
    text(
      margin + 14,
      headerTop - 50,
      `Patient: ${payload.userLabel}`,
      11,
      false,
      "1 1 1",
    );
    text(
      margin + 14,
      headerTop - 68,
      `Range: ${payload.rangeLabel}`,
      11,
      false,
      "1 1 1",
    );
    text(
      margin + 14,
      headerTop - 84,
      `Generated: ${new Date().toLocaleString()}`,
      10,
      false,
      "1 1 1",
    );

    if (logoAsset) {
      const headerBottom = headerTop - headerHeight;
      const maxLogoWidth = 72;
      const maxLogoHeight = 58;
      const logoScale = Math.min(
        maxLogoWidth / logoAsset.width,
        maxLogoHeight / logoAsset.height,
        1,
      );
      const drawWidth = logoAsset.width * logoScale;
      const drawHeight = logoAsset.height * logoScale;
      const logoX = margin + contentWidth - 14 - drawWidth;
      const logoY = headerBottom + (headerHeight - drawHeight) / 2;

      cmds.push(
        `q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${logoX.toFixed(2)} ${logoY.toFixed(2)} cm /Im1 Do Q`,
      );
    } else {
      rect(margin + contentWidth - 86, headerTop - 78, 72, 58, "1 1 1");
      text(
        margin + contentWidth - 74,
        headerTop - 46,
        "CureMate",
        10,
        true,
        "0.36 0.29 0.81",
      );
      text(
        margin + contentWidth - 70,
        headerTop - 60,
        "Logo",
        9,
        false,
        "0.36 0.29 0.81",
      );
    }

    let tableY = headerTop - headerHeight - 28;

    if (pageIndex === 0) {
      const metricGap = 8;
      const metricWidth = (contentWidth - metricGap * 3) / 4;
      const metricY = tableY;
      const metrics = [
        ["Adherence", `${payload.adherence}%`],
        ["Taken", String(payload.takenCount)],
        ["Missed", String(payload.missedCount)],
        ["Total schedules", String(payload.totalCount)],
      ];

      metrics.forEach((item, index) => {
        const x = margin + index * (metricWidth + metricGap);
        rect(
          x,
          metricY - 46,
          metricWidth,
          46,
          "0.97 0.97 0.99",
          "0.89 0.91 0.93",
        );
        text(x + 8, metricY - 20, item[0], 10, false, "0.42 0.45 0.50");
        text(x + 8, metricY - 36, item[1], 18, true, "0.12 0.16 0.23");
      });

      tableY = metricY - 74;
    }

    text(margin, tableY, "Detailed medicine logs", 13, true, "0.12 0.16 0.23");
    tableY -= 22;

    let x = margin;
    columnDefs.forEach((col) => {
      rect(x, tableY - 18, col.width, 18, "0.36 0.29 0.81");
      text(x + 4, tableY - 12, col.label, 8, true, "1 1 1");
      x += col.width;
    });

    tableY -= 18;

    rowsForPage.forEach((row, rowIndex) => {
      const rowFill = rowIndex % 2 === 0 ? "0.97 0.97 0.99" : "1 1 1";
      rect(
        margin,
        tableY - 18,
        columnDefs.reduce((sum, col) => sum + col.width, 0),
        18,
        rowFill,
        "0.89 0.91 0.93",
      );

      let cellX = margin;
      row.forEach((value, colIndex) => {
        const col = columnDefs[colIndex];
        const maxChars = Math.max(4, Math.floor(col.width / 5.8));
        text(
          cellX + 4,
          tableY - 12,
          truncate(String(value ?? ""), maxChars),
          8,
        );
        cellX += col.width;
      });

      tableY -= 18;
    });

    text(
      margin,
      24,
      `Page ${pageIndex + 1} of ${rowGroups.length}`,
      9,
      false,
      "0.42 0.45 0.50",
    );
    return cmds.join("\n");
  };

  const objects: string[] = [];
  const pushObj = (id: number, body: string) => {
    objects[id] = `${id} 0 obj\n${body}\nendobj\n`;
  };

  const logoObjectId = logoAsset ? 5 : null;
  const firstPageObjectId = logoAsset ? 6 : 5;
  const pageObjectIds = rowGroups.map((_, idx) => firstPageObjectId + idx * 2);
  const contentObjectIds = rowGroups.map(
    (_, idx) => firstPageObjectId + idx * 2 + 1,
  );
  const totalObjects = 4 + (logoAsset ? 1 : 0) + rowGroups.length * 2;

  pushObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  pushObj(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${rowGroups.length} >>`,
  );
  pushObj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pushObj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  if (logoAsset && logoObjectId) {
    const logoStream = `${logoAsset.hexData}>`;
    pushObj(
      logoObjectId,
      `<< /Type /XObject /Subtype /Image /Width ${logoAsset.width} /Height ${logoAsset.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${logoStream.length} >>\nstream\n${logoStream}\nendstream`,
    );
  }

  rowGroups.forEach((group, index) => {
    const content = buildPageContent(group, index);

    const xObjectResource =
      logoAsset && logoObjectId
        ? ` /XObject << /Im1 ${logoObjectId} 0 R >>`
        : "";

    pushObj(
      pageObjectIds[index],
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObjectResource} >> /Contents ${contentObjectIds[index]} 0 R >>`,
    );

    pushObj(
      contentObjectIds[index],
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let id = 1; id <= totalObjects; id += 1) {
    offsets[id] = pdf.length;
    pdf += objects[id];
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${totalObjects + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id <= totalObjects; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payload.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function ReportScreen() {
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme] as ThemeColors;
  const { width } = useWindowDimensions();
  const isCompactWidth = width < 390;
  const [selectedFilter, setSelectedFilter] =
    useState<FilterOption>("This Week");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [rangePickerTarget, setRangePickerTarget] =
    useState<RangePickerTarget>(null);
  const [customStartDate, setCustomStartDate] = useState(() =>
    addDays(new Date(), -6),
  );
  const [customEndDate, setCustomEndDate] = useState(() => new Date());
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const {
    reportsLogsByKey,
    reportsLoadedVersionByKey,
    reportsVersion,
    setReportsLogs,
  } = useScreenDataCache();

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const range = useMemo(
    () =>
      getFilterRange(selectedFilter, {
        start: customStartDate,
        end: customEndDate,
      }),
    [customEndDate, customStartDate, selectedFilter],
  );

  const rangeKey = useMemo(
    () => getRangeKey(selectedFilter, range),
    [range, selectedFilter],
  );

  const rangeLabel = useMemo(() => {
    if (selectedFilter === "Custom Range") {
      return `${formatLongDateLabel(range.start)} - ${formatLongDateLabel(range.end)}`;
    }

    if (selectedFilter === "This Month") {
      return range.start.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }

    if (selectedFilter === "Last 30 Days") {
      return `${formatDateLabel(range.start)} - ${formatDateLabel(range.end)}`;
    }

    return `${formatDateLabel(range.start)} - ${formatDateLabel(range.end)}`;
  }, [range.end, range.start, selectedFilter]);

  const chartMode: ChartMode =
    selectedFilter === "This Week" &&
    daysBetweenInclusive(range.start, range.end) <= 7
      ? "daily"
      : "weekly";

  const loadReports = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const cached = reportsLogsByKey[rangeKey];
      const loadedVersion = reportsLoadedVersionByKey[rangeKey] ?? -1;

      if (!force && cached && loadedVersion === reportsVersion) {
        setLogs(cached as Log[]);
        setLoading(false);
        return;
      }

      if (force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const data = (await getLogsByDateRange(
          toLocalIsoDate(range.start),
          toLocalIsoDate(range.end),
        )) as Log[];

        const sorted = [...data].sort((left, right) => {
          if (left.date !== right.date) {
            return left.date.localeCompare(right.date);
          }
          return left.time.localeCompare(right.time);
        });

        setReportsLogs(rangeKey, sorted);
        setLogs(sorted);
      } catch (error) {
        console.error("Failed to load reports", error);
        setLogs([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      range.end,
      range.start,
      rangeKey,
      reportsLoadedVersionByKey,
      reportsLogsByKey,
      reportsVersion,
      setReportsLogs,
    ],
  );

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const takenCount = logs.filter((log) => log.status === "taken").length;
  const missedCount = logs.filter((log) => log.status === "missed").length;
  const totalCount = logs.length;
  const adherence = calculateAdherence(logs);
  const series = useMemo(
    () => buildChartSeries(logs, range, chartMode),
    [chartMode, logs, range],
  );
  const chartMax = Math.max(
    1,
    ...series.map((item) => Math.max(item.taken, item.missed)),
  );

  const filterLabel =
    selectedFilter === "Custom Range" ? "Custom Range" : selectedFilter;
  const userLabel = getUserLabel();

  const exportPdf = async () => {
    try {
      if (logs.length === 0) {
        Alert.alert("No data", "There is no report data to export yet.");
        return;
      }

      setExporting(true);
      const fileName = buildPdfFileName(range);
      const html = buildPdfHtml({
        userLabel,
        rangeLabel,
        startLabel: formatLongDateLabel(range.start),
        endLabel: formatLongDateLabel(range.end),
        adherence,
        takenCount,
        missedCount,
        totalCount,
        logs,
      });

      if (Platform.OS === "web") {
        downloadPdfOnWeb({
          userLabel,
          rangeLabel,
          startLabel: formatLongDateLabel(range.start),
          endLabel: formatLongDateLabel(range.end),
          adherence,
          takenCount,
          missedCount,
          totalCount,
          logs,
          fileName,
        });
        return;
      }

      const result = await Print.printToFileAsync({ html });
      const savedUri = await savePdfToDevice(result.uri, fileName);

      if (Platform.OS === "ios" && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(savedUri, {
          mimeType: "application/pdf",
          dialogTitle: "Save or share report",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF saved", `Report saved to ${savedUri}`);
      }
    } catch (error) {
      console.error("Failed to export report", error);
      Alert.alert("Export failed", "We couldn't generate the PDF report.");
    } finally {
      setExporting(false);
    }
  };

  const chartTitle =
    chartMode === "daily" ? "Daily activity" : "Weekly summary";
  const chartSubtitle =
    chartMode === "daily"
      ? "Daily bars show taken and missed doses across the selected week."
      : "Grouped weekly bars make longer ranges easier to read.";

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <DecorativeBackground theme={theme} currentTheme={currentTheme} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadReports({ force: true });
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <View style={styles.topRow}>
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: theme.text }]}>Reports</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Real Firebase logs for the selected period
            </Text>
          </View>

          <Pressable
            style={[
              styles.filterButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => setShowFilterMenu(true)}
          >
            <View style={styles.filterButtonTextWrap}>
              <Text style={[styles.filterButtonText, { color: theme.text }]}>
                {filterLabel}
              </Text>
              {selectedFilter === "Custom Range" ? (
                <Text
                  style={[
                    styles.filterButtonCaption,
                    { color: theme.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {rangeLabel}
                </Text>
              ) : null}
            </View>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={22}
              color={theme.textSecondary}
            />
          </Pressable>
        </View>

        {selectedFilter === "Custom Range" ? (
          <View style={styles.rangeGrid}>
            <Pressable
              style={[
                styles.rangeCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={() => setRangePickerTarget("start")}
            >
              <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>
                Start Date
              </Text>
              <Text
                style={[styles.rangeValue, { color: theme.text }]}
                numberOfLines={1}
              >
                {formatLongDateLabel(range.start)}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.rangeCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={() => setRangePickerTarget("end")}
            >
              <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>
                End Date
              </Text>
              <Text
                style={[styles.rangeValue, { color: theme.text }]}
                numberOfLines={1}
              >
                {formatLongDateLabel(range.end)}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.heroCardWrap}>
          <View
            style={[
              styles.heroCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.heroLeft}>
              <View
                style={[styles.circleOuter, { borderColor: theme.primarySoft }]}
              >
                <View
                  style={[
                    styles.circleInner,
                    { backgroundColor: theme.surfaceAlt },
                  ]}
                >
                  <Text style={[styles.percent, { color: theme.text }]}>
                    {loading ? "--" : `${adherence}%`}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.heroRight}>
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                Adherence
              </Text>
              <Text
                style={[
                  styles.heroCopy,
                  { color: adherence >= 75 ? theme.success : theme.primary },
                ]}
              >
                {adherence >= 75
                  ? "Great job keeping on track"
                  : "Keep going - consistency builds the streak"}
              </Text>
              <Text
                style={[styles.heroRange, { color: theme.textSecondary }]}
                numberOfLines={2}
              >
                {rangeLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: theme.successSoft,
                borderColor: theme.success,
              },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.success }]}>
              {takenCount}
            </Text>
            <Text style={[styles.statLabel, { color: theme.success }]}>
              Taken
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.danger }]}>
              {missedCount}
            </Text>
            <Text style={[styles.statLabel, { color: theme.danger }]}>
              Missed
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.text }]}>
              {totalCount}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Total
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View
            style={[
              styles.chartHeader,
              isCompactWidth && styles.chartHeaderCompact,
            ]}
          >
            <View>
              <Text style={[styles.chartTitle, { color: theme.text }]}>
                {chartTitle}
              </Text>
              <Text
                style={[styles.chartSubtitle, { color: theme.textSecondary }]}
              >
                {chartSubtitle}
              </Text>
            </View>

            <View
              style={[
                styles.legendRow,
                isCompactWidth && styles.legendRowCompact,
              ]}
            >
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: theme.success }]}
                />
                <Text style={[styles.legendText, { color: theme.text }]}>
                  Taken
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: theme.danger }]}
                />
                <Text style={[styles.legendText, { color: theme.text }]}>
                  Missed
                </Text>
              </View>
            </View>
          </View>

          {logs.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIconWrap,
                  { backgroundColor: theme.primarySoft },
                ]}
              >
                <MaterialIcons
                  name="assessment"
                  size={28}
                  color={theme.primary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No report data available
              </Text>
              <Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>
                Take medicines consistently and your report summary will appear
                here.
              </Text>
            </View>
          ) : (
            <View style={styles.chartArea}>
              {series.map((item) => (
                <View
                  key={`${item.label}-${item.subtitle}`}
                  style={styles.chartColumn}
                >
                  <View style={styles.barCluster}>
                    <View style={styles.barSlot}>
                      <View
                        style={[
                          styles.bar,
                          {
                            backgroundColor: theme.success,
                            height: `${(item.taken / chartMax) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.barSlot}>
                      <View
                        style={[
                          styles.bar,
                          {
                            backgroundColor: theme.danger,
                            height: `${(item.missed / chartMax) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <Text style={[styles.chartLabel, { color: theme.text }]}>
                    {item.label}
                  </Text>
                  <Text
                    style={[styles.chartMeta, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {item.subtitle}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Pressable
          onPress={() => void exportPdf()}
          disabled={exporting}
          style={[
            styles.exportButton,
            { backgroundColor: theme.primary, opacity: exporting ? 0.8 : 1 },
          ]}
        >
          <MaterialIcons name="picture-as-pdf" size={20} color="#FFFFFF" />
          <Text style={styles.exportButtonText}>
            {exporting ? "Preparing PDF..." : "Download PDF Report"}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        transparent
        visible={showFilterMenu}
        animationType="fade"
        onRequestClose={() => setShowFilterMenu(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}
          onPress={() => setShowFilterMenu(false)}
        >
          <Pressable
            style={[
              styles.menuCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => {}}
          >
            {FILTER_OPTIONS.map((option) => {
              const active = option === selectedFilter;
              return (
                <Pressable
                  key={option}
                  style={[
                    styles.menuItem,
                    active && { backgroundColor: theme.primarySoft },
                  ]}
                  onPress={() => {
                    setSelectedFilter(option);
                    setShowFilterMenu(false);
                  }}
                >
                  <Text
                    style={[
                      styles.menuText,
                      { color: active ? theme.primary : theme.text },
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {rangePickerTarget ? (
        <DatePickerModal
          open={!!rangePickerTarget}
          title={
            rangePickerTarget === "start"
              ? "Choose Start Date"
              : "Choose End Date"
          }
          value={rangePickerTarget === "start" ? range.start : range.end}
          minimumDate={
            rangePickerTarget === "start" ? undefined : customStartDate
          }
          maximumDate={
            rangePickerTarget === "start"
              ? customEndDate < new Date()
                ? customEndDate
                : new Date()
              : new Date()
          }
          theme={theme}
          onCancel={() => setRangePickerTarget(null)}
          onConfirm={(pickedDate) => {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut,
            );
            if (rangePickerTarget === "start") {
              setCustomStartDate(pickedDate);
              if (pickedDate > customEndDate) {
                setCustomEndDate(pickedDate);
              }
            } else {
              if (pickedDate < customStartDate) {
                setCustomStartDate(pickedDate);
              }
              setCustomEndDate(pickedDate);
            }
            setSelectedFilter("Custom Range");
            setRangePickerTarget(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F9FB",
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  titleWrap: {
    flex: 1,
    paddingRight: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
  },
  filterButton: {
    minWidth: 136,
    maxWidth: 180,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterButtonTextWrap: {
    flex: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },
  filterButtonCaption: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  rangeGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  rangeCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rangeLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  rangeValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  heroCardWrap: {
    marginBottom: 16,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  heroLeft: {
    width: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  circleOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  circleInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
  },
  percent: {
    fontSize: 28,
    fontWeight: "900",
  },
  heroRight: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  heroCopy: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  heroRange: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  chartCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  chartHeaderCompact: {
    flexDirection: "column",
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    maxWidth: 240,
  },
  legendRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  legendRowCompact: {
    justifyContent: "flex-start",
    marginTop: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: "700",
  },
  chartArea: {
    minHeight: 270,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 10,
  },
  chartColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 34,
  },
  barCluster: {
    width: 32,
    height: 190,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  barSlot: {
    width: 13,
    height: 190,
    justifyContent: "flex-end",
  },
  bar: {
    width: 13,
    borderRadius: 7,
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  chartMeta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 14,
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 26,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
  },
  emptyIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyCopy: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  exportButton: {
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  exportButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 100,
    paddingHorizontal: 18,
  },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    width: 180,
    alignSelf: "flex-end",
  },
  menuItem: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  menuText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
