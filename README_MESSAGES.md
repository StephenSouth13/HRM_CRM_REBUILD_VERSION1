Messaging setup and migration instructions

1) Apply SQL migrations

- Ensure your base schema (profiles, user_roles) is present. Run migrations in order. From project root (PowerShell):

```powershell
$env:DATABASE_URL = "postgres://<user>:<pass>@<host>:5432/<db>"
.\scripts\apply_migrations.ps1
```

Or run SQL files manually from the `migrations/` folder in timestamp order. The messaging migrations are:

- migrations/20260106000000_create_messages.sql
- migrations/20260106000100_enhance_messages.sql
- migrations/20260106000200_attachments_and_mute_notifications.sql
- migrations/20260106000300_seed_messages.sql (optional; replace placeholder IDs before running)

2) Create Supabase Storage bucket

- Using Supabase dashboard or CLI, create a bucket named `message-attachments`.
- For public access (quick testing), allow public read on the bucket. For production, use private bucket + signed URLs.

3) Configure policies

- If you use Supabase with RLS, ensure policies allow users to insert/select their messages and manage attachments.

4) Running locally

- Start dev server:

```powershell
pnpm dev
```

- Visit /messages to test chat UI.
