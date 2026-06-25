"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Copy, ExternalLink, ToggleLeft, ToggleRight } from "lucide-react";

interface FormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "select";
  required: boolean;
  options?: string[];
}

interface Form {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
  active: boolean;
  created_at: string;
}

interface Props { projectId: string; projectName: string; }

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function ProjectForms({ projectId, projectName }: Props) {
  const [forms, setForms]   = useState<Form[]>([]);
  const [editing, setEditing] = useState<Form | null>(null);
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState<string | null>(null);

  useEffect(() => {
    supabase.from("BT_forms").select("*").eq("project_id", projectId).order("created_at")
      .then(({ data }) => setForms((data as Form[]) ?? []));
  }, [projectId]);

  const newForm = (): Form => ({
    id: "new",
    name: `${projectName} Intake`,
    description: "",
    fields: [
      { id: uid(), label: "Summary", type: "text", required: true },
      { id: uid(), label: "Details", type: "textarea", required: false },
      { id: uid(), label: "Your email", type: "email", required: false },
    ],
    active: true,
    created_at: new Date().toISOString(),
  });

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    if (editing.id === "new") {
      const { data } = await supabase.from("BT_forms").insert({ project_id: projectId, name: editing.name, description: editing.description, fields: editing.fields, active: editing.active }).select().single();
      if (data) { setForms(prev => [...prev, data as Form]); }
    } else {
      await supabase.from("BT_forms").update({ name: editing.name, description: editing.description, fields: editing.fields, active: editing.active }).eq("id", editing.id);
      setForms(prev => prev.map(f => f.id === editing.id ? { ...f, ...editing } : f));
    }
    setEditing(null); setSaving(false);
  };

  const deleteForm = async (id: string) => {
    setForms(prev => prev.filter(f => f.id !== id));
    await supabase.from("BT_forms").delete().eq("id", id);
  };

  const toggleActive = async (id: string, active: boolean) => {
    setForms(prev => prev.map(f => f.id === id ? { ...f, active } : f));
    await supabase.from("BT_forms").update({ active }).eq("id", id);
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/forms/${id}`);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    if (!editing) return;
    setEditing({ ...editing, fields: editing.fields.map((f, i) => i === idx ? { ...f, ...patch } : f) });
  };

  const addField = () => {
    if (!editing) return;
    setEditing({ ...editing, fields: [...editing.fields, { id: uid(), label: "New field", type: "text", required: false }] });
  };

  const removeField = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, fields: editing.fields.filter((_, i) => i !== idx) });
  };

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#151B26]">{editing.id === "new" ? "New form" : "Edit form"}</h3>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-[#4573D9] text-white text-sm rounded hover:bg-[#3F65C4] disabled:opacity-50">Save</button>
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 border border-[#E8E8E9] text-sm rounded hover:bg-[#F5F5F5]">Cancel</button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Form name" className="w-full text-sm border border-[#E8E8E9] rounded px-3 py-2 outline-none focus:border-[#4573D9]" />
          <input value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Description (optional)" className="w-full text-sm border border-[#E8E8E9] rounded px-3 py-2 outline-none focus:border-[#4573D9]" />
          <div className="flex flex-col gap-2">
            {editing.fields.map((f, idx) => (
              <div key={f.id} className="border border-[#E8E8E9] rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input value={f.label} onChange={e => updateField(idx, { label: e.target.value })} placeholder="Label" className="flex-1 text-sm border border-[#E8E8E9] rounded px-2 py-1 outline-none focus:border-[#4573D9]" />
                  <select value={f.type} onChange={e => updateField(idx, { type: e.target.value as FormField["type"] })} className="text-sm border border-[#E8E8E9] rounded px-2 py-1 bg-white outline-none">
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="email">Email</option>
                    <option value="select">Dropdown</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-[#6B6F76] cursor-pointer">
                    <input type="checkbox" checked={f.required} onChange={e => updateField(idx, { required: e.target.checked })} /> Req
                  </label>
                  <button onClick={() => removeField(idx)} className="p-1 text-[#B0B3B8] hover:text-red-500"><Trash2 size={13} /></button>
                </div>
                {f.type === "select" && (
                  <input value={(f.options ?? []).join(", ")} onChange={e => updateField(idx, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="Options: A, B, C" className="w-full text-xs border border-[#E8E8E9] rounded px-2 py-1 outline-none focus:border-[#4573D9]" />
                )}
              </div>
            ))}
            <button onClick={addField} className="flex items-center gap-1.5 text-sm text-[#4573D9] hover:underline"><Plus size={13} /> Add field</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#151B26]">Intake Forms</h3>
        <button onClick={() => setEditing(newForm())} className="text-xs text-[#4573D9] hover:underline">+ New form</button>
      </div>
      {forms.length === 0 && <p className="text-xs text-[#9EA3AA]">No forms yet. Create one to let people submit tasks without an account.</p>}
      <div className="flex flex-col gap-3">
        {forms.map(f => (
          <div key={f.id} className="border border-[#E8E8E9] rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#151B26] truncate">{f.name}</div>
                {f.description && <div className="text-xs text-[#9EA3AA] mt-0.5 truncate">{f.description}</div>}
                <div className="text-[10px] text-[#B0B3B8] mt-1">{f.fields.length} fields</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleActive(f.id, !f.active)} title={f.active ? "Disable form" : "Enable form"} className={`p-1 rounded ${f.active ? "text-emerald-500" : "text-[#B0B3B8]"}`}>
                  {f.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
                <button onClick={() => copyLink(f.id)} title="Copy public link" className="p-1 text-[#6B6F76] hover:text-[#4573D9]">
                  {copied === f.id ? <span className="text-[10px] text-emerald-500">Copied!</span> : <Copy size={13} />}
                </button>
                <a href={`/forms/${f.id}`} target="_blank" rel="noopener noreferrer" className="p-1 text-[#6B6F76] hover:text-[#4573D9]"><ExternalLink size={13} /></a>
                <button onClick={() => setEditing({ ...f })} className="p-1 text-[#6B6F76] hover:text-[#4573D9] text-xs">Edit</button>
                <button onClick={() => deleteForm(f.id)} className="p-1 text-[#B0B3B8] hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
