@AGENTS.md

# Bug Tracker — Project Overview

**Stack:** Next.js 16.2.9 App Router · TypeScript · Tailwind CSS v4 · Supabase · lucide-react

## Supabase Tables (all RLS disabled, prefix BT_)
- `BT_projects` — id, name, description, icon_bg, created_at, updated_at
- `BT_sections` — id, project_id, name, position, created_at
- `BT_tasks` — id, section_id, project_id, name, description, status, priority, task_type, assignee, due_date, completed, completed_at, position, created_at, updated_at
- `BT_attachments` — id, task_id, name, url, file_type, size, uploaded_at
- `BT_column_configs` — id, project_id, column_key, visible, position
- `BT_settings` — key (PK), value (jsonb), updated_at

## Key Architecture
- `AdminSettingsProvider` wraps app; loads statuses/priorities/task_types/storage from `BT_settings`
- `useProject(projectId)` — single hook instance per page; all mutations optimistic
- Task detail panel receives all mutation functions as props from TaskList (no separate hook)
- Storage upload: `/api/upload` reads config from DB first, falls back to `.env`

## Admin Panel (`/admin`)
Configurable: Status labels · Priority labels · Task Type labels · Storage provider (Supabase/Cloudflare R2/Cloudinary/Local)

## Task List Features
- Inline task name edit (single click) · Double-click row or › icon opens detail panel
- Multi-select via radio circle → bulk update status/due_date/any column
- Search, filter, sort · ESC closes detail panel
- Paste multi-line text → creates one task per line
- Columns toggle via Options panel; task_type visible by default

## Cloudinary Upload
Unsigned upload preset required. Credentials stored in `BT_settings` key `storage_config`.

## Scripts
- `node start.js` — start dev server
- `node deploy.js push "msg"` — commit + push to GitHub
- `node deploy.js pull` — pull + npm install
