"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, ChevronDown } from "lucide-react";

interface Field {
  id: string;
  name: string;
  field_type: "text" | "number" | "date" | "dropdown" | "checkbox";
  options: string[] | null;
  position: number;
}

interface FieldValue {
  field_id: string;
  value: string;
}

interface Props {
  projectId: string;
  taskId: string;
  isAdmin?: boolean;
}

export default function CustomFieldsPanel({ projectId, taskId, isAdmin }: Props) {
  const [fields, setFields]   = useState<Field[]>([]);
  const [values, setValues]   = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Field["field_type"]>("text");
  const [newOpts, setNewOpts] = useState("");

  useEffect(() => {
    supabase.from("BT_custom_fields").select("*").eq("project_id", projectId).order("position")
      .then(({ data }) => setFields((data as Field[]) ?? []));
    supabase.from("BT_task_field_values").select("field_id, value").eq("task_id", taskId)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const v of (data as FieldValue[]) ?? []) map[v.field_id] = v.value;
        setValues(map);
      });
  }, [projectId, taskId]);

  const upsertValue = async (fieldId: string, value: string) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    await supabase.from("BT_task_field_values").upsert({ task_id: taskId, field_id: fieldId, value, updated_at: new Date().toISOString() }, { onConflict: "task_id,field_id" });
  };

  const addField = async () => {
    if (!newName.trim()) return;
    const opts = newType === "dropdown" ? newOpts.split(",").map(s => s.trim()).filter(Boolean) : null;
    const { data } = await supabase.from("BT_custom_fields").insert({ project_id: projectId, name: newName.trim(), field_type: newType, options: opts, position: fields.length }).select().single();
    if (data) setFields(prev => [...prev, data as Field]);
    setNewName(""); setNewOpts(""); setShowAdd(false);
  };

  const deleteField = async (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    await supabase.from("BT_custom_fields").delete().eq("id", id);
  };

  if (fields.length === 0 && !isAdmin) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-[#151B26]">Custom Fields</span>
        {isAdmin && <button onClick={() => setShowAdd(v => !v)} className="text-[#6B6F76] hover:text-[#4573D9]"><Plus size={14} /></button>}
      </div>

      {/* Add field form */}
      {showAdd && isAdmin && (
        <div className="border border-[#E8E8E9] rounded-lg p-3 mb-3 flex flex-col gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Field name" className="w-full text-sm border border-[#E8E8E9] rounded px-2 py-1.5 outline-none focus:border-[#4573D9]" />
          <select value={newType} onChange={e => setNewType(e.target.value as Field["field_type"])} className="w-full text-sm border border-[#E8E8E9] rounded px-2 py-1.5 outline-none bg-white">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="dropdown">Dropdown</option>
            <option value="checkbox">Checkbox</option>
          </select>
          {newType === "dropdown" && (
            <input value={newOpts} onChange={e => setNewOpts(e.target.value)} placeholder="Options: A, B, C" className="w-full text-sm border border-[#E8E8E9] rounded px-2 py-1.5 outline-none focus:border-[#4573D9]" />
          )}
          <div className="flex gap-2">
            <button onClick={addField} className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded hover:bg-[#3F65C4]">Add</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 border border-[#E8E8E9] text-sm rounded hover:bg-[#F5F5F5]">Cancel</button>
          </div>
        </div>
      )}

      {/* Field values */}
      <div className="flex flex-col gap-2">
        {fields.map(f => (
          <div key={f.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 group">
            <div className="flex items-center gap-1 w-28 flex-shrink-0">
              <span className="text-xs text-[#6B6F76] truncate">{f.name}</span>
              {isAdmin && (
                <button onClick={() => deleteField(f.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-[#B0B3B8] hover:text-red-500 flex-shrink-0"><Trash2 size={11} /></button>
              )}
            </div>
            <div className="flex-1">
              {f.field_type === "text" && (
                <input value={values[f.id] ?? ""} onChange={e => upsertValue(f.id, e.target.value)} placeholder="—" className="w-full text-sm border border-[#E8E8E9] rounded px-2 py-1 outline-none focus:border-[#4573D9]" />
              )}
              {f.field_type === "number" && (
                <input type="number" value={values[f.id] ?? ""} onChange={e => upsertValue(f.id, e.target.value)} placeholder="—" className="w-full text-sm border border-[#E8E8E9] rounded px-2 py-1 outline-none focus:border-[#4573D9]" />
              )}
              {f.field_type === "date" && (
                <input type="date" value={values[f.id] ?? ""} onChange={e => upsertValue(f.id, e.target.value)} className="w-full text-sm border border-[#E8E8E9] rounded px-2 py-1 outline-none focus:border-[#4573D9]" />
              )}
              {f.field_type === "checkbox" && (
                <input type="checkbox" checked={values[f.id] === "true"} onChange={e => upsertValue(f.id, e.target.checked ? "true" : "false")} className="w-4 h-4 accent-[#4573D9]" />
              )}
              {f.field_type === "dropdown" && (
                <select value={values[f.id] ?? ""} onChange={e => upsertValue(f.id, e.target.value)} className="w-full text-sm border border-[#E8E8E9] rounded px-2 py-1 outline-none bg-white focus:border-[#4573D9]">
                  <option value="">—</option>
                  {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          </div>
        ))}
        {fields.length === 0 && isAdmin && (
          <p className="text-xs text-[#9EA3AA]">No custom fields. Click + to add one.</p>
        )}
      </div>
    </div>
  );
}
