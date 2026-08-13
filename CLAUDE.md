@AGENTS.md

# Bug Tracker — Project Overview

**Stack:** Next.js 16.2.9 App Router · TypeScript · Tailwind CSS v4 · Supabase · lucide-react · dnd-kit (Board drag-drop) · recharts (Dashboard/Admin charts)

## Supabase Tables (all RLS disabled, prefix `BT_`)
Core:
- `BT_projects` — id, name, description, icon_bg, is_active, status (on_track/at_risk/off_track), is_favorite, export_prefix, export_prefix_format, jira_project_key, last_excel_export_at, created_at, updated_at
- `BT_sections` — id, project_id, name, position, created_at
- `BT_tasks` — id, section_id, project_id, name, description, status, priority, task_type, assignee, due_date, completed, completed_at, position, parent_task_id (subtasks), is_milestone, start_date, jira_issue_key/jira_has_updates/jira_last_pushed_at/jira_remote_updated_at/jira_pushed_status, created_at, updated_at
- `BT_attachments` — id, task_id, name, url, file_type, size, uploaded_at
- `BT_column_configs` — id, project_id, column_key, visible, position
- `BT_settings` — key (PK), value (jsonb), updated_at

Collaboration:
- `BT_project_members` — project_id, user_id, role (in-app membership/access control)
- `BT_project_shares` — project_id, email, role, notify_new_tasks (external/email-based sharing, see `ShareProjectModal`)
- `BT_comments` — task_id, project_id, user_email, content, parent_comment_id (threaded)
- `BT_task_followers` — task_id, user_email
- `BT_notifications` — user_email, type, title, body, project_id, task_id, read (powers `InboxPanel`, see `lib/notify.ts`)
- `BT_assignment_requests` — task_id, project_id, requested_by, requester_email, assignee_email, status (pending-approval workflow when `require_assignee_approval` is on)
- `BT_activity_logs` — project_id, task_id, user_email, action, meta (jsonb) — see `lib/logActivity.ts`

Structure & extensibility:
- `BT_custom_fields` / `BT_task_field_values` — per-project custom fields (`CustomFieldsPanel`)
- `BT_task_dependencies` — task_id, depends_on_id (Gantt dependency links)
- `BT_forms` — public intake forms per project (`/forms/[id]`, `ProjectForms`)
- `BT_project_updates` — project_id, status, note (status-update log, `ProjectStatusUpdates`)
- `BT_templates` — reusable project templates (structure jsonb)

**Non-obvious DB behavior:** a Postgres trigger (`bt_touch_project_from_child` / `bt_touch_project_from_attachment`, applied via migration, not in the repo) bumps `BT_projects.updated_at` whenever a task/section/attachment under it changes — so "Last modified" on the projects list reflects activity inside the project, not just edits to the project row itself.

## Key Architecture
- `AdminSettingsProvider` (`lib/adminSettingsContext.tsx`) wraps app; loads statuses/priorities/task_types/storage config + permission flags (`lock_priorities`, `require_assignee_approval`, `members_manage_members`, `members_jira_export`, `members_excel_export`) from `BT_settings`
- `ProjectProvider` (`lib/store.tsx`) holds the global project list for the whole session
- `useProject(projectId, userEmail, initialData?)` (`hooks/useProject.ts`) — single hook instance per project page; all mutations optimistic. `app/projects/[id]/page.tsx` fetches project/sections/tasks/columns server-side and passes them in as `initialData` so first paint isn't a blank spinner; the hook does a silent background re-sync after
- Task detail panel (`TaskDetailPanel`) receives all mutation functions as props from `TaskList` (no separate hook). Closing/navigating away from a task left blank (no name/description/attachments) auto-deletes it — the delete is deferred a tick so React Strict Mode's dev-only mount→unmount→remount cycle can't trigger a false delete
- `middleware.ts` gates every route behind Supabase auth except `_next/static`, `_next/image`, `favicon.ico`, `icon`, `apple-icon`, `manifest.webmanifest`, `sw.js`, and `api/` — those must stay public (browser install-prompt/favicon fetches carry no auth)
- Storage upload: `/api/upload` reads config from DB (`storage_config` in `BT_settings`) first, falls back to `.env`

## Views (`/projects/[id]`)
List (default) · Board (Kanban, drag-drop via dnd-kit — mobile pages one column at a time with a section-picker strip) · Calendar (month grid by due date) · Gantt (timeline with dependencies) · Dashboard (recharts: status/section/completion-over-time charts, project status updates, forms).

## Admin Panel (`/admin`)
- Dashboard: workspace stats (projects/tasks/completion/overdue) + charts, server-fetched
- Settings (`/admin/settings`): Status labels · Priority labels (+ lock to admin-only) · Task Type labels · Storage provider (Supabase/Cloudflare R2/Cloudinary/Local) · Export defaults · Jira integration config · pending assignment requests
- Users (`/admin/users`), Permissions (`/admin/permissions`), Activity log (`/admin/activity`, backed by `BT_activity_logs`)

## Task List Features
- Inline task name edit (single click) · Double-click row or › icon opens detail panel · Attachments render directly under the task name in the detail panel
- Multi-select via radio circle → bulk update status/due_date/any column
- Search, filter, sort (List columns; the projects list sorts by Name and Last modified) · ESC closes detail panel
- Paste multi-line text → creates one task per line
- Columns toggle via Options panel; task_type visible by default
- Subtasks, comments, followers, dependencies, custom fields, task sharing (`ShareTaskModal`)

## Jira Integration
`app/api/jira/*` (export, sync, delete, resolve-project, test) + `JiraSection` admin config. Per-task Jira link state lives on `BT_tasks.jira_*` columns.

## Export
`lib/exportUtils.ts` — CSV/Excel/PDF/JSON, per-project or bulk (multi-select on `/projects`). Excel/PDF libs (`xlsx-js-style`, `jspdf`) are dynamically imported, not in the main bundle.

## Cloudinary Upload
Unsigned upload preset required. Credentials stored in `BT_settings` key `storage_config`.

## Mobile / PWA
Full mobile-responsive pass done (List/Board/Calendar/Gantt/Dashboard, all modals/panels). Installable PWA: `app/manifest.ts`, icon generated via `next/og` (`app/icon.tsx`, `app/apple-icon.tsx`, `app/api/pwa-icon` for manifest sizes — see `lib/appIcon.tsx` for the shared mark), service worker (`public/sw.js`, registered prod-only by `ServiceWorkerRegister`, caches static assets only — never Supabase/API responses), iOS install hint (`InstallPrompt`). No offline data editing.

## Scripts
- `node start.js` — start dev server
- `node deploy.js push "msg"` — commit + push to GitHub
- `node deploy.js pull` — pull + npm install
