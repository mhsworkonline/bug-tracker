import type { Project, Section, Task } from "./data";
import { STATUS_LABELS, PRIORITY_LABELS } from "./data";

function taskRows(sections: Section[], tasks: Task[]) {
  return tasks.map((t, i) => {
    const section = sections.find(s => s.id === t.section_id);
    const attachments = t.BT_attachments ?? [];
    return {
      "S.No.":             i + 1,
      "Section":           section?.name ?? "",
      "Task Name":         t.name,
      "Status":            (STATUS_LABELS as Record<string, string>)[t.status] ?? t.status,
      "Priority":          t.priority ? ((PRIORITY_LABELS as Record<string, string>)[t.priority] ?? t.priority) : "",
      "Assignee":          t.assignee ?? "",
      "Due Date":          t.due_date ?? "",
      "Completed":         t.completed ? "Yes" : "No",
      "Completed On":      t.completed_at ? new Date(t.completed_at).toLocaleDateString() : "",
      "Description":       t.description ?? "",
      "Attachment Names":  attachments.map(a => a.name).join("; "),
      "Attachment URLs":   attachments.map(a => a.url).join("; "),
      "Created At":        new Date(t.created_at).toLocaleDateString(),
      "Last Modified":     new Date(t.updated_at).toLocaleDateString(),
    };
  });
}

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV(project: Project, sections: Section[], tasks: Task[]) {
  const rows = taskRows(sections, tasks);
  if (!rows.length) { alert("No tasks to export."); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers, ...rows.map(r => Object.values(r))]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  download(`${project.name}-tasks.csv`, "text/csv", csv);
}

export async function exportToExcel(project: Project, sections: Section[], tasks: Task[]) {
  const XLSX = await import("xlsx-js-style");
  const rows = taskRows(sections, tasks);
  if (!rows.length) { alert("No tasks to export."); return; }

  const headers = Object.keys(rows[0]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map(r => Object.values(r))]);

  // Header row: bold, larger font, blue bg, wrap text
  headers.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    ws[ref].s = {
      font:      { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
      fill:      { fgColor: { rgb: "4573D9" } },
      alignment: { wrapText: true, vertical: "center", horizontal: "center" },
    };
  });

  // Data rows: wrap text + hyperlink on URL column
  const urlColIdx = headers.indexOf("Attachment URLs");
  rows.forEach((row, rowIdx) => {
    headers.forEach((h, c) => {
      const ref = XLSX.utils.encode_cell({ r: rowIdx + 1, c });
      if (!ws[ref]) return;
      const isUrl = c === urlColIdx && ws[ref].v;
      ws[ref].s = {
        alignment: { wrapText: true, vertical: "top" },
        ...(isUrl ? { font: { color: { rgb: "4573D9" }, underline: true } } : {}),
      };
      if (isUrl) ws[ref].l = { Target: String(ws[ref].v).split("; ")[0] };
    });
  });

  // Freeze top row + column widths
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!cols"]   = headers.map(h => ({ wch: Math.min(45, Math.max(14, h.length + 4)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  XLSX.writeFile(wb, `${project.name}-tasks.xlsx`);
}

export async function exportToPDF(project: Project, sections: Section[], tasks: Task[]) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setTextColor(21, 27, 38);
  doc.text(project.name, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(107, 111, 118);
  doc.text(`Exported ${new Date().toLocaleDateString()}`, 14, 25);

  const rows = taskRows(sections, tasks);
  const head = [Object.keys(rows[0] ?? {})];
  const body = rows.map(r => Object.values(r));

  autoTable(doc, {
    startY: 30,
    head,
    body,
    headStyles: { fillColor: [69, 115, 217], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 251, 252] },
  });

  doc.save(`${project.name}-tasks.pdf`);
}

export function exportToJSON(project: Project, sections: Section[], tasks: Task[]) {
  const payload = { project, sections, tasks };
  download(`${project.name}.json`, "application/json", JSON.stringify(payload, null, 2));
}
