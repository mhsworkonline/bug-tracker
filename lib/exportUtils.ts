import type { Project, Section, Task } from "./data";
import { STATUS_LABELS, PRIORITY_LABELS } from "./data";
import type { TaskTypeOption } from "./adminSettings";

const STATUS_COLORS: Record<string, string> = {
  not_started:  "F1F5F9",
  in_progress:  "EFF6FF",
  ready_for_qa: "F0FDFA",
  in_review:    "F5F3FF",
  done:         "F0FDF4",
  blocked:      "FFF1F2",
  completed:    "ECFDF5",
};

const STATUS_TEXT: Record<string, string> = {
  not_started:  "475569",
  in_progress:  "1D4ED8",
  ready_for_qa: "0F766E",
  in_review:    "6D28D9",
  done:         "15803D",
  blocked:      "BE123C",
  completed:    "047857",
};

const PRIORITY_COLORS: Record<string, string> = {
  show_stopper: "FFF1F2",
  high:         "FFF7ED",
  medium:       "FFFBEB",
  low:          "F7FEE7",
};

const PRIORITY_TEXT: Record<string, string> = {
  show_stopper: "9F1239",
  high:         "C2410C",
  medium:       "B45309",
  low:          "4D7C0F",
};


const BORDER = {
  top:    { style: "thin", color: { rgb: "D1D5DB" } },
  bottom: { style: "thin", color: { rgb: "D1D5DB" } },
  left:   { style: "thin", color: { rgb: "D1D5DB" } },
  right:  { style: "thin", color: { rgb: "D1D5DB" } },
};

// Fixed: max 3 attachment columns. Att1 & Att2 are individual URLs.
// If task has >2 attachments, the 3rd column gets the 3rd URL (clickable).
// Any beyond 3 are omitted (edge case — most tasks have ≤2).
const MAX_ATT_COLS = 2;

function hasAnyAttachments(tasks: Task[]): boolean {
  return tasks.some(t => (t.BT_attachments ?? []).length > 0);
}

// Column order: S.No. → Section → Task Name → Att1 → Att2 → [Att3] → Status → Priority → Task Type → Assignee → Due Date → Completed → Description
function buildHeaders(tasks: Task[]): string[] {
  const maxAtts = Math.min(MAX_ATT_COLS, Math.max(0, ...tasks.map(t => (t.BT_attachments ?? []).length)));
  const headers = ["S.No.", "Section", "Task Name"];
  for (let i = 1; i <= maxAtts; i++) headers.push(`Attachment ${i}`);
  headers.push("Status", "Priority", "Task Type", "Assignee", "Due Date", "Completed", "Description");
  return headers;
}

function formatTaskName(name: string, sectionName: string | undefined, project: Project): string {
  if (!project.export_prefix || !sectionName) return name;
  const fmt = project.export_prefix_format ?? "colon";
  if (fmt === "bracket") return `[${sectionName}] ${name}`;
  if (fmt === "slash")   return `${sectionName} / ${name}`;
  return `${sectionName}: ${name}`;
}

function taskRows(sections: Section[], tasks: Task[], taskTypes: TaskTypeOption[], project: Project) {
  const maxAtts = Math.min(MAX_ATT_COLS, Math.max(0, ...tasks.map(t => (t.BT_attachments ?? []).length)));
  return tasks.map((t, i) => {
    const section     = sections.find(s => s.id === t.section_id);
    const attachments = t.BT_attachments ?? [];
    const ttLabel     = taskTypes.find(x => x.key === (t.task_type ?? "bug"))?.label ?? (t.task_type ?? "bug");
    const row: Record<string, string | number> = {
      "S.No.":       i + 1,
      "Section":     section?.name ?? "",
      "Task Name":   formatTaskName(t.name, section?.name, project),
    };
    for (let j = 0; j < maxAtts; j++) {
      row[`Attachment ${j + 1}`] = attachments[j]?.url ?? "";
    }
    row["Status"]      = (STATUS_LABELS as Record<string, string>)[t.status] ?? t.status;
    row["Priority"]    = (PRIORITY_LABELS as Record<string, string>)[t.priority ?? "high"] ?? "High";
    row["Task Type"]   = ttLabel;
    row["Assignee"]    = t.assignee ?? "";
    row["Due Date"]    = t.due_date ?? "";
    row["Completed"]   = t.completed && t.completed_at ? new Date(t.completed_at).toLocaleDateString() : "";
    row["Description"] = t.description ?? "";
    return row;
  });
}

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV(project: Project, sections: Section[], tasks: Task[], taskTypes: TaskTypeOption[]) {
  const rows = taskRows(sections, tasks, taskTypes, project);
  if (!rows.length) { alert("No tasks to export."); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers, ...rows.map(r => Object.values(r))]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  download(`${project.name}-tasks.csv`, "text/csv", csv);
}

// Excel sheet name limits: <=31 chars, no \ / ? * [ ] : ; dedupes clashing names.
function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/?*[\]:]/g, "").trim() || "Project";
  if (base.length > 31) base = base.slice(0, 31);
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// Builds and styles a single project's worksheet. Shared by single- and multi-project Excel export.
function buildProjectSheet(
  XLSX: typeof import("xlsx-js-style"),
  project: Project,
  sections: Section[],
  tasks: Task[],
  taskTypes: TaskTypeOption[],
) {
  const headers    = buildHeaders(tasks);
  const rows       = taskRows(sections, tasks, taskTypes, project);
  const totalRows  = rows.length + 1; // +1 for header
  const totalCols  = headers.length;

  const att1Idx     = headers.indexOf("Attachment 1");
  const att2Idx     = headers.indexOf("Attachment 2");
  const statusIdx   = headers.indexOf("Status");
  const priorityIdx = headers.indexOf("Priority");
  const taskTypeIdx = headers.indexOf("Task Type");
  const nameIdx     = headers.indexOf("Task Name");
  const descIdx     = headers.indexOf("Description");

  const isAttCol = (c: number) => c === att1Idx || c === att2Idx;

  const aoa: (string | number)[][] = [
    headers,
    ...rows.map(r => headers.map(h => r[h] ?? "")),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Header row styling
  headers.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[ref]) ws[ref] = { v: "", t: "s" };
    ws[ref].s = {
      font:      { bold: true, sz: 13, color: { rgb: "FFFFFF" } },
      fill:      { fgColor: { rgb: "334155" } },
      alignment: { wrapText: true, vertical: "center", horizontal: "center" },
      border:    FILLED_BORDER,
    };
  });

  // Data row styling
  rows.forEach((_, rowIdx) => {
    const r = rowIdx + 1;
    headers.forEach((__, c) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { v: "", t: "s" };

      const base: Record<string, unknown> = {
        alignment: { wrapText: true, vertical: "top" },
        border:    BORDER,
      };

      // Status color
      if (c === statusIdx) {
        const statusKey = tasks[rowIdx].status;
        const bg  = STATUS_COLORS[statusKey];
        const txt = STATUS_TEXT[statusKey];
        if (bg) {
          base.fill = { fgColor: { rgb: bg } };
          base.font = { color: { rgb: txt ?? "374151" }, bold: true };
          base.alignment = { wrapText: true, vertical: "top", horizontal: "center" };
        }
      }

      // Task Type color (from admin settings)
      if (c === taskTypeIdx) {
        const ttKey = tasks[rowIdx].task_type ?? "bug";
        const tt = taskTypes.find(x => x.key === ttKey);
        if (tt) {
          const bg  = tt.bg.replace("#", "");
          const txt = tt.text.replace("#", "");
          base.fill = { fgColor: { rgb: bg } };
          base.font = { color: { rgb: txt }, bold: true };
          base.alignment = { wrapText: true, vertical: "top", horizontal: "center" };
        }
      }

      // Priority color
      if (c === priorityIdx) {
        const prKey = tasks[rowIdx].priority ?? "high";
        const bg  = PRIORITY_COLORS[prKey];
        const txt = PRIORITY_TEXT[prKey];
        if (bg) {
          base.fill = { fgColor: { rgb: bg } };
          base.font = { color: { rgb: txt ?? "374151" }, bold: true };
          base.alignment = { wrapText: true, vertical: "top", horizontal: "center" };
        }
      }

      // Attachment hyperlinks
      if (isAttCol(c)) {
        const url = String(ws[ref].v ?? "");
        if (url) {
          base.font = { color: { rgb: "4573D9" }, underline: true };
          ws[ref].l = { Target: url };
          ws[ref].v = url;
        }
      }

      ws[ref].s = base;
    });
  });

  // Also apply border to any empty trailing cells in the range
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < totalCols; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) {
        ws[ref] = { v: "", t: "s", s: { border: BORDER, alignment: { wrapText: true, vertical: "top" } } };
      }
    }
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows - 1, c: totalCols - 1 } });

  // Column widths
  ws["!cols"] = headers.map((h, i) => {
    if (i === nameIdx)                return { wch: 40 };
    if (i === descIdx)                return { wch: 35 };
    if (isAttCol(i))                  return { wch: 25 };
    if (h === "Section")              return { wch: 20 };
    if (h === "Status")               return { wch: 16 };
    if (h === "Priority")             return { wch: 16 };
    if (h === "Task Type")            return { wch: 14 };
    return { wch: Math.max(12, h.length + 4) };
  });

  return ws;
}

// Darker/solid border for the curtailed sheet only — keeps the full-report BORDER const untouched.
const FILLED_BORDER = {
  top:    { style: "thin", color: { rgb: "64748B" } },
  bottom: { style: "thin", color: { rgb: "64748B" } },
  left:   { style: "thin", color: { rgb: "64748B" } },
  right:  { style: "thin", color: { rgb: "64748B" } },
};

// Curtailed sheet: S.No., Section, Task Name, Attachment 1, Attachment 2 only.
// Sorted by Section name; S.No. renumbered from that sorted order. Fully separate from buildProjectSheet.
function buildAttachmentsOnlySheet(
  XLSX: typeof import("xlsx-js-style"),
  project: Project,
  sections: Section[],
  tasks: Task[],
) {
  const headers   = ["S.No.", "Section", "Task Name", "Attachment 1", "Attachment 2"];
  const att1Idx   = 3;
  const att2Idx   = 4;
  const isAttCol  = (c: number) => c === att1Idx || c === att2Idx;

  const sorted = tasks
    .map(t => ({ task: t, sectionName: sections.find(s => s.id === t.section_id)?.name ?? "" }))
    .sort((a, b) => a.sectionName.localeCompare(b.sectionName));

  const rows = sorted.map(({ task, sectionName }, i) => {
    const attachments = task.BT_attachments ?? [];
    return [
      i + 1,
      sectionName,
      formatTaskName(task.name, sectionName, project),
      attachments[0]?.url ?? "",
      attachments[1]?.url ?? "",
    ];
  });

  const totalRows = rows.length + 1;
  const totalCols = headers.length;

  const aoa: (string | number)[][] = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Header row styling
  headers.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[ref]) ws[ref] = { v: "", t: "s" };
    ws[ref].s = {
      font:      { bold: true, sz: 13, color: { rgb: "FFFFFF" } },
      fill:      { fgColor: { rgb: "334155" } },
      alignment: { wrapText: true, vertical: "center", horizontal: "center" },
      border:    FILLED_BORDER,
    };
  });

  // Data row styling
  rows.forEach((_, rowIdx) => {
    const r = rowIdx + 1;
    headers.forEach((__, c) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { v: "", t: "s" };

      const base: Record<string, unknown> = {
        alignment: { wrapText: true, vertical: "top" },
        border:    FILLED_BORDER,
      };

      if (isAttCol(c)) {
        const url = String(ws[ref].v ?? "");
        if (url) {
          base.font = { color: { rgb: "4573D9" }, underline: true };
          ws[ref].l = { Target: url };
          ws[ref].v = url;
        }
      }

      ws[ref].s = base;
    });
  });

  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < totalCols; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) {
        ws[ref] = { v: "", t: "s", s: { border: FILLED_BORDER, alignment: { wrapText: true, vertical: "top" } } };
      }
    }
  }
  const fullRange = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows - 1, c: totalCols - 1 } });
  ws["!ref"] = fullRange;
  ws["!autofilter"] = { ref: fullRange };

  ws["!cols"] = headers.map((h, i) => {
    if (i === 0)      return { wch: 8 };
    if (i === 1)      return { wch: 20 };
    if (i === 2)      return { wch: 40 };
    if (isAttCol(i))  return { wch: 25 };
    return { wch: Math.max(12, h.length + 4) };
  });

  return ws;
}

// Curtailed export: S.No., Section, Task Name, Attachment 1, Attachment 2 — sorted by Section name.
// Fully separate from exportToExcel — does not reuse buildProjectSheet.
export async function exportToExcelAttachmentsOnly(project: Project, sections: Section[], tasks: Task[]) {
  const XLSX = await import("xlsx-js-style");
  if (!tasks.length) { alert("No tasks to export."); return; }

  const ws = buildAttachmentsOnlySheet(XLSX, project, sections, tasks);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attachments");
  await freezeHeaderRowAndDownload(XLSX, wb, `${project.name}-attachments.xlsx`);
}

// Freezes the header row on every sheet in the workbook (raw XML patch — xlsx-js-style has no API for this).
async function freezeHeaderRowAndDownload(XLSX: typeof import("xlsx-js-style"), wb: import("xlsx-js-style").WorkBook, filename: string) {
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import("fflate");
  const raw   = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as number[]);
  const files = unzipSync(raw);
  const pane = '<pane xSplit="0" ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>';
  for (let i = 1; i <= wb.SheetNames.length; i++) {
    const sheetKey = `xl/worksheets/sheet${i}.xml`;
    if (!files[sheetKey]) continue;
    let xml = strFromU8(files[sheetKey]);
    xml = xml
      .replace(/(<sheetView\b[^>]*)\/>/,             `$1>${pane}</sheetView>`)
      .replace(/(<sheetView\b[^>]*>)<\/sheetView>/, `$1${pane}</sheetView>`);
    files[sheetKey] = strToU8(xml);
  }

  const blob = new Blob([zipSync(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function exportToExcel(project: Project, sections: Section[], tasks: Task[], taskTypes: TaskTypeOption[]) {
  const XLSX = await import("xlsx-js-style");
  if (!tasks.length) { alert("No tasks to export."); return; }

  const ws = buildProjectSheet(XLSX, project, sections, tasks, taskTypes);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  await freezeHeaderRowAndDownload(XLSX, wb, `${project.name}-tasks.xlsx`);
}

// One workbook, one tab per selected project. Projects with no tasks still get a header-only tab.
export async function exportProjectsToExcel(
  projects: Project[],
  dataByProject: Map<string, { sections: Section[]; tasks: Task[] }>,
  taskTypes: TaskTypeOption[],
) {
  if (!projects.length) { alert("No projects selected."); return; }
  const XLSX = await import("xlsx-js-style");

  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  for (const project of projects) {
    const data = dataByProject.get(project.id) ?? { sections: [], tasks: [] };
    const ws = buildProjectSheet(XLSX, project, data.sections, data.tasks, taskTypes);
    const sheetName = safeSheetName(project.name, usedNames);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  await freezeHeaderRowAndDownload(XLSX, wb, `bug-tracker-export-${stamp}.xlsx`);
}

export async function exportToPDF(project: Project, sections: Section[], tasks: Task[], taskTypes: TaskTypeOption[]) {
  const { default: jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setTextColor(21, 27, 38);
  doc.text(project.name, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(107, 111, 118);
  doc.text(`Exported ${new Date().toLocaleDateString()}`, 14, 25);

  const rows = taskRows(sections, tasks, taskTypes, project);
  if (!rows.length) { alert("No tasks to export."); return; }

  const head = [Object.keys(rows[0])];
  const body = rows.map(r => Object.values(r).map(String));

  autoTable(doc, {
    startY: 30,
    head,
    body,
    headStyles:         { fillColor: [51, 65, 85], fontSize: 8 },
    bodyStyles:         { fontSize: 7 },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    columnStyles:       { 2: { cellWidth: 40 }, 9: { cellWidth: 40 } },
  });

  doc.save(`${project.name}-tasks.pdf`);
}

export function exportToJSON(project: Project, sections: Section[], tasks: Task[]) {
  const payload = { project, sections, tasks };
  download(`${project.name}.json`, "application/json", JSON.stringify(payload, null, 2));
}
