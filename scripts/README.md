# Photo Processing Scripts

Python workflow for processing photos after an event (e.g. Easter photo day).

## Workflow Overview

```
SD card dump (flat folder)
        ↓
group_photos.py     → staging/  (split by family, QR-decoded session IDs)
        ↓
flag_photos.py      → staging/review.html  (quality check gallery)
        ↓
Manual review       → delete bad shots, edit in Lightroom/Photos/etc.
        ↓
upload_photos.py    → Supabase  (batch upload, marks sessions ready)
```

## Setup (one time)

```bash
# Create a venv inside the scripts folder and install deps
python3 -m venv scripts/venv
scripts/venv/bin/pip install -r scripts/requirements.txt
brew install zbar   # macOS — required for QR decoding
```

> If your venv is at a different path, substitute it in the commands below.

## Step 1 — Group photos by family

```bash
scripts/venv/bin/python3 scripts/group_photos.py /Volumes/SD_CARD/DCIM --gap 2 --out staging/
```

Sorts all photos by capture time (EXIF), then splits into groups whenever there
is a gap of more than `--gap` minutes between shots (default: 2).

**The first photo of each family's sequence must include their printed QR card.**
The script decodes the QR → extracts the session UUID → names the staging folder
automatically (e.g. `staging/3f8a1b2c-.../`).

Groups where the QR cannot be read are named `group_NNN_UNMATCHED`. You can
manually rename these to the correct session UUID before uploading, or assign
them interactively during the upload step.

Options:
- `--gap N` — minutes between shots that triggers a new group (default: 2)
- `--out DIR` — output staging directory (default: `staging/`)
- `--dry-run` — show what would happen without copying any files

## Step 2 — Flag quality issues

```bash
scripts/venv/bin/python3 scripts/flag_photos.py staging/ --open
```

Scans every photo in each staging subfolder and generates `staging/review.html`:
a gallery organized by session, with red borders on flagged photos.

**Quality checks:**
| Issue | Threshold |
|-------|-----------|
| Blurry | Laplacian variance < 80 |
| Underexposed | Mean brightness < 50 |
| Overexposed | Mean brightness > 210 |

After reviewing, **delete** any photos you don't want to keep, then edit/enhance
the rest in Lightroom, Apple Photos, or any editor. Save edits back to the same
staging folder.

Options:
- `--open` — open `review.html` in your default browser automatically
- `--blur-threshold N` — adjust blur sensitivity
- `--dark-threshold N` — adjust underexposure cutoff
- `--bright-threshold N` — adjust overexposure cutoff

## Step 3 — Upload to Supabase

```bash
scripts/venv/bin/python3 scripts/upload_photos.py staging/ --env .env.local
```

Reads credentials from `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`), then for each staging subfolder:

1. Matches the folder name (session UUID) to a session in the database
2. Uploads each photo to Supabase Storage (`photos` bucket)
3. Inserts a record in the `photos` table
4. Sets `photos_ready = true` on the session

**Safe to re-run** — already-uploaded files are detected and skipped.

For `UNMATCHED` folders, you will be prompted to pick a session interactively.

Options:
- `--env FILE` — path to env file (default: `.env.local`)
- `--dry-run` — show upload plan without uploading anything
