#!/usr/bin/env python3
"""
upload_photos.py — Upload staged photo folders to their Supabase sessions.

Each subfolder in the staging directory should be named with a session UUID
(as produced by group_photos.py). This script:
  1. Lists sessions from Supabase
  2. Maps each staging folder to a session by UUID
  3. Uploads photos to Supabase Storage (bucket: photos)
  4. Inserts records into the photos table
  5. Sets photos_ready = true on the session
  6. Skips already-uploaded files (idempotent)

Usage:
  python scripts/upload_photos.py staging/ --env .env.local

Requirements:
  pip install -r scripts/requirements.txt
"""

import os
import re
import time
from pathlib import Path

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.prompt import Prompt
from supabase import create_client, Client

console = Console()

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.heic', '.heif', '.tiff', '.tif', '.webp'}

CONTENT_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.webp': 'image/webp',
}


def find_env_file(env_file: Path) -> Path:
    """Resolve env file path, searching parent directories if not found at given path."""
    if env_file.exists():
        return env_file
    # Walk up from cwd looking for the file
    current = Path.cwd()
    for _ in range(4):
        candidate = current / env_file.name
        if candidate.exists():
            return candidate
        current = current.parent
    raise click.ClickException(
        f"Could not find {env_file.name} in {Path.cwd()} or any parent directory"
    )


def make_supabase(env_file: Path) -> Client:
    env_file = find_env_file(env_file)
    load_dotenv(env_file, override=True)
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise click.ClickException(
            f"Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in {env_file}"
        )
    return create_client(url, key)


def get_sessions(sb: Client) -> list[dict]:
    """Return sessions that have not yet been marked photos_ready."""
    result = (
        sb.table('sessions')
        .select('id,label')
        .eq('photos_ready', False)
        .order('created_at', desc=True)
        .execute()
    )
    return result.data or []


def notify_registrations(sb: Client, session_id: str) -> tuple[int, int]:
    """Send photo-ready emails to all unnotified registrations for a session."""
    resend_key = os.environ.get('RESEND_API_KEY')
    from_email = os.environ.get('RESEND_FROM_EMAIL')
    site_url = os.environ.get('NEXT_PUBLIC_SITE_URL', '').rstrip('/')

    if not resend_key or not from_email:
        console.print("  [dim]Skipping notifications — RESEND_API_KEY or RESEND_FROM_EMAIL not set[/dim]")
        return 0, 0

    result = sb.table('registrations').select('id,email,access_token').eq('session_id', session_id).is_('notified_at', 'null').execute()
    registrations = result.data or []

    sent, failed = 0, 0
    for reg in registrations:
        photo_url = f"{site_url}/photos/{reg['access_token']}"
        try:
            import urllib.request, json as _json
            payload = _json.dumps({
                'from': f'St. John Photo Station <{from_email}>',
                'to': reg['email'],
                'subject': 'Your St. John photos are ready',
                'html': f'<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h1 style="font-size:20px;color:#111">Your photos are ready</h1><p style="color:#555">Your St. John Armenian Apostolic Church photos are ready to view and download.</p><a href="{photo_url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block">View My Photos</a><p style="color:#999;font-size:12px;margin-top:16px">{photo_url}</p></div>',
            }).encode()
            req = urllib.request.Request(
                'https://api.resend.com/emails',
                data=payload,
                headers={'Authorization': f'Bearer {resend_key}', 'Content-Type': 'application/json'},
                method='POST',
            )
            with urllib.request.urlopen(req) as resp:
                resp.read()
            sb.table('registrations').update({'notified_at': __import__('datetime').datetime.utcnow().isoformat()}).eq('id', reg['id']).execute()
            sent += 1
        except Exception as e:
            console.print(f"  [red]Email failed for {reg['email']}: {e}[/red]")
            failed += 1

    return sent, failed


def get_uploaded_paths(sb: Client, session_id: str) -> set[str]:
    """Return set of storage_path values already uploaded for this session."""
    result = sb.table('photos').select('storage_path').eq('session_id', session_id).execute()
    return {row['storage_path'] for row in (result.data or [])}


def safe_filename(name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9._-]', '_', name)


def upload_file(sb: Client, session_id: str, photo_path: Path, existing_paths: set[str]) -> tuple[bool, str]:
    """Upload one file. Returns (success, message)."""
    timestamp = int(time.time() * 1000)
    safe_name = safe_filename(photo_path.name)
    storage_path = f'{session_id}/{timestamp}_{safe_name}'

    # Idempotency: check if a path with same filename suffix already exists
    existing_match = next(
        (p for p in existing_paths if p.endswith(f'_{safe_name}')), None
    )
    if existing_match:
        return True, f'skipped (already uploaded as {existing_match.split("/")[-1]})'

    content_type = CONTENT_TYPES.get(photo_path.suffix.lower(), 'image/jpeg')

    try:
        data = photo_path.read_bytes()
        sb.storage.from_('photos').upload(
            storage_path, data,
            file_options={'content-type': content_type}
        )
    except Exception as e:
        return False, f'storage error: {e}'

    try:
        sb.table('photos').insert({
            'session_id': session_id,
            'filename': photo_path.name,
            'storage_path': storage_path,
        }).execute()
    except Exception as e:
        return False, f'db error: {e}'

    return True, 'uploaded'


@click.command()
@click.argument('staging', type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option('--env', 'env_file', default='.env.local', show_default=True,
              type=click.Path(path_type=Path), help='Path to .env file with Supabase credentials')
@click.option('--dry-run', is_flag=True, help='Show what would be uploaded without uploading')
def main(staging: Path, env_file: Path, dry_run: bool):
    """Upload staged photo folders to Supabase sessions.

    STAGING is the directory produced by group_photos.py, containing one
    subfolder per session (named with the session UUID).
    """
    sb = make_supabase(env_file)
    sessions = get_sessions(sb)
    if not sessions:
        raise click.ClickException("No sessions found in Supabase.")

    session_by_id = {s['id']: s for s in sessions}
    session_dirs = sorted([d for d in staging.iterdir() if d.is_dir()])

    if not session_dirs:
        console.print(f"[red]No subdirectories found in {staging}[/red]")
        return

    # Build mapping: folder → session_id
    mapping: dict[Path, str] = {}
    unmatched: list[Path] = []

    for d in session_dirs:
        folder_name = d.name
        if folder_name in session_by_id:
            mapping[d] = folder_name
        elif folder_name.endswith('_UNMATCHED') or folder_name.startswith('group_'):
            unmatched.append(d)
        else:
            # Try partial match on UUID prefix
            matches = [sid for sid in session_by_id if sid.startswith(folder_name)]
            if len(matches) == 1:
                mapping[d] = matches[0]
            else:
                unmatched.append(d)

    # Handle unmatched folders interactively
    if unmatched:
        console.print(f"\n[yellow]{len(unmatched)} folder(s) could not be automatically matched:[/yellow]")
        for d in unmatched:
            console.print(f"  [cyan]{d.name}[/cyan]")

        console.print("\nAvailable sessions:")
        for i, s in enumerate(sessions, 1):
            console.print(f"  {i:3}. [{s['id'][:8]}] {s['label'] or '(no label)'}")

        for d in unmatched:
            images = [p for p in d.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS]
            console.print(f"\nFolder [cyan]{d.name}[/cyan] ({len(images)} photos)")

            # Open the first actual image so the photographer can identify the family
            first_image = next(
                (p for p in sorted(d.iterdir())
                 if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS and p.name != '_preview.jpg'),
                None
            )
            if first_image:
                import subprocess
                subprocess.Popen(['open', str(first_image)])
                console.print(f"  [dim]Opening {first_image.name}[/dim]")

            choice = Prompt.ask(
                "Enter session number to assign (or press Enter to skip)",
                default=''
            )
            if choice.strip().isdigit():
                idx = int(choice.strip()) - 1
                if 0 <= idx < len(sessions):
                    mapping[d] = sessions[idx]['id']
                    console.print(f"  → Assigned to [{sessions[idx]['id'][:8]}] {sessions[idx]['label']}")
            else:
                console.print(f"  → Skipping [cyan]{d.name}[/cyan]")

    if not mapping:
        console.print("\n[yellow]Nothing to upload.[/yellow]")
        return

    # Summary table
    table = Table(title="Upload Plan", show_lines=True)
    table.add_column("Folder", style="cyan")
    table.add_column("Session", style="green")
    table.add_column("Photos", justify="right")

    total_photos = 0
    for d, sid in sorted(mapping.items()):
        images = [p for p in d.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS]
        session_label = session_by_id[sid]['label'] or '(no label)'
        table.add_row(d.name[:40], f"{session_label} [{sid[:8]}]", str(len(images)))
        total_photos += len(images)

    console.print(table)
    console.print(f"\n[bold]{total_photos}[/bold] photos to upload across [bold]{len(mapping)}[/bold] sessions")

    if dry_run:
        console.print("\n[dim]Dry run — no files uploaded.[/dim]")
        return

    # Upload
    from rich.progress import Progress, SpinnerColumn, BarColumn, TaskProgressColumn, TextColumn

    overall_uploaded = 0
    overall_skipped = 0
    overall_errors = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    ) as progress:
        for d, session_id in sorted(mapping.items()):
            session_label = session_by_id[session_id]['label'] or session_id[:8]
            images = sorted([
                p for p in d.iterdir()
                if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
            ])

            existing_paths = get_uploaded_paths(sb, session_id)
            task = progress.add_task(f"[cyan]{session_label}[/cyan]", total=len(images))

            session_uploaded = 0
            session_errors = []

            for photo in images:
                success, msg = upload_file(sb, session_id, photo, existing_paths)
                if success:
                    session_uploaded += 1
                    if 'skipped' not in msg:
                        overall_uploaded += 1
                    else:
                        overall_skipped += 1
                else:
                    overall_errors += 1
                    session_errors.append(f'{photo.name}: {msg}')
                progress.advance(task)

            # Mark session ready and notify registered users
            if session_uploaded > 0:
                try:
                    sb.table('sessions').update({'photos_ready': True}).eq('id', session_id).execute()
                except Exception as e:
                    console.print(f"[yellow]Warning: could not mark session ready: {e}[/yellow]")

                notify_sent, notify_failed = notify_registrations(sb, session_id)
                if notify_sent:
                    console.print(f"  [green]Notified {notify_sent} registration(s)[/green]")
                if notify_failed:
                    console.print(f"  [yellow]Failed to notify {notify_failed} registration(s) — retry from admin UI[/yellow]")

            if session_errors:
                for err in session_errors:
                    console.print(f"  [red]Error:[/red] {err}")

    console.print(f"\n[green]Done.[/green] "
                  f"Uploaded: [bold]{overall_uploaded}[/bold]  "
                  f"Skipped: [dim]{overall_skipped}[/dim]  "
                  f"Errors: {'[red]' if overall_errors else ''}{overall_errors}{'[/red]' if overall_errors else ''}")

    if overall_uploaded > 0:
        console.print("\nFamilies can now access their photos. Sessions marked as [green]photos_ready[/green].")


if __name__ == '__main__':
    main()
