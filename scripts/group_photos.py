#!/usr/bin/env python3
"""
group_photos.py — Split a flat photo dump into per-family session folders.

The photographer shoots photos sequentially: each family's set begins with a
shot of their QR card. This script:
  1. Sorts all images by capture time (EXIF DateTimeOriginal, or file mtime)
  2. Splits into groups whenever the gap between consecutive shots exceeds --gap minutes
  3. Decodes the QR code from the first photo of each group to get the session ID
  4. Copies photos into staging/<sessionId>/ or staging/group_NNN_UNMATCHED/

Usage:
  python scripts/group_photos.py /path/to/photos --gap 2 --out staging/

Requirements:
  pip install -r scripts/requirements.txt
  brew install zbar  # macOS (provides libzbar for pyzbar)
"""

import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qs

import click
from PIL import Image
from PIL.ExifTags import TAGS
from rich.console import Console
from rich.table import Table

try:
    from pyzbar.pyzbar import decode as qr_decode
    PYZBAR_AVAILABLE = True
except ImportError:
    PYZBAR_AVAILABLE = False

console = Console()

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.heic', '.heif', '.tiff', '.tif', '.raw', '.cr2', '.nef', '.arw'}


def get_capture_time(path: Path) -> datetime:
    """Return capture time from EXIF DateTimeOriginal, falling back to mtime."""
    try:
        with Image.open(path) as img:
            exif_data = img._getexif()
            if exif_data:
                for tag_id, value in exif_data.items():
                    tag = TAGS.get(tag_id, tag_id)
                    if tag == 'DateTimeOriginal':
                        return datetime.strptime(value, '%Y:%m:%d %H:%M:%S')
    except Exception:
        pass
    return datetime.fromtimestamp(path.stat().st_mtime)


def load_fast(path: Path, max_px: int = 1024) -> Image.Image:
    """Load image at reduced resolution for fast QR scanning.

    Uses Pillow's draft() for JPEGs, which skips decoding most pixel data
    and is 4-8x faster than loading the full image from a slow SD card.
    """
    img = Image.open(path)
    if hasattr(img, 'draft'):
        # draft() hints to the JPEG decoder to load at 1/2, 1/4, or 1/8 size
        img.draft('RGB', (max_px, max_px))
    img.load()
    img.thumbnail((max_px, max_px), Image.LANCZOS)
    return img.convert('RGB')


def decode_session_id(path: Path) -> str | None:
    """Decode QR code from image and extract session UUID (uid param)."""
    if not PYZBAR_AVAILABLE:
        return None
    try:
        img = load_fast(path)
        w, h = img.size
        # Try at loaded size, then 2x upscale for small/distant QR codes
        for target in [img, img.resize((w * 2, h * 2), Image.LANCZOS)]:
            results = qr_decode(target)
            for result in results:
                url = result.data.decode('utf-8', errors='ignore')
                parsed = urlparse(url)
                params = parse_qs(parsed.query)
                uid = params.get('uid', [None])[0]
                if uid:
                    return uid
    except Exception:
        pass
    return None


def get_images(source_dir: Path) -> list[Path]:
    """Return all image files in source_dir, sorted by capture time."""
    images = [
        p for p in source_dir.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    ]
    console.print(f"Found [bold]{len(images)}[/bold] images in [cyan]{source_dir}[/cyan]")
    console.print("Sorting by capture time...", end=' ')
    images.sort(key=get_capture_time)
    console.print("[green]done[/green]")
    return images


def split_into_groups(images: list[Path], gap_minutes: float) -> list[list[Path]]:
    """Split sorted images into groups based on time gap or QR code change.

    Scans every photo for QR codes to detect family transitions, but uses
    fast reduced-resolution loading to minimise SD card read time.
    Once a group's QR is confirmed, mid-group photos are scanned only to
    detect a new QR (skipped if same or none).
    """
    if not images:
        return []

    from rich.progress import Progress, SpinnerColumn, BarColumn, TaskProgressColumn, TextColumn, TimeRemainingColumn

    groups: list[list[Path]] = []
    current_group = [images[0]]
    current_time = get_capture_time(images[0])
    current_qr = decode_session_id(images[0]) if PYZBAR_AVAILABLE else None

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Scanning for QR codes...", total=len(images) - 1)

        for img in images[1:]:
            t = get_capture_time(img)
            gap = (t - current_time).total_seconds() / 60
            new_qr = decode_session_id(img) if PYZBAR_AVAILABLE else None

            # Start a new group on time gap OR when a different QR code is detected
            if gap > gap_minutes or (new_qr and new_qr != current_qr):
                groups.append(current_group)
                current_group = [img]
                if new_qr:
                    current_qr = new_qr
            else:
                current_group.append(img)
            current_time = t
            progress.advance(task)

    groups.append(current_group)
    return groups


@click.command()
@click.argument('source', type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option('--gap', default=2.0, show_default=True, help='Minutes between shots that triggers a new group')
@click.option('--out', default='staging', show_default=True, type=click.Path(path_type=Path), help='Output staging directory')
@click.option('--dry-run', is_flag=True, help='Show what would happen without copying files')
def main(source: Path, gap: float, out: Path, dry_run: bool):
    """Group sequential photos into per-family session folders.

    SOURCE is the directory containing the flat photo dump from the SD card.
    The first photo of each group should show the family's QR card so the
    session ID can be decoded automatically.
    """
    if not PYZBAR_AVAILABLE:
        console.print("[yellow]Warning:[/yellow] pyzbar not installed — QR decoding disabled. "
                      "Install with: pip install pyzbar && brew install zbar")

    images = get_images(source)
    if not images:
        console.print("[red]No images found.[/red]")
        return

    console.print(f"\nSplitting into groups (gap threshold: [bold]{gap}[/bold] min)...")
    groups = split_into_groups(images, gap)
    console.print(f"Found [bold]{len(groups)}[/bold] groups\n")

    table = Table(title="Photo Groups", show_lines=True)
    table.add_column("Folder", style="cyan", no_wrap=True)
    table.add_column("Photos", justify="right")
    table.add_column("Session ID", style="green")
    table.add_column("First File")

    results = []
    unmatched_count = 0

    for i, group in enumerate(groups, start=1):
        first = group[0]
        # Scan all photos in group for a decodable QR (first photo may be blurry)
        session_id = None
        if PYZBAR_AVAILABLE:
            for photo in group:
                session_id = decode_session_id(photo)
                if session_id:
                    break

        if session_id:
            folder_name = session_id
            session_display = session_id[:8] + '...'
        else:
            unmatched_count += 1
            folder_name = f'group_{i:03d}_UNMATCHED'
            session_display = '[yellow]UNMATCHED[/yellow]'

        results.append((folder_name, group))
        table.add_row(folder_name[:40], str(len(group)), session_display, first.name)

    console.print(table)

    if unmatched_count:
        console.print(f"\n[yellow]{unmatched_count} unmatched group(s)[/yellow] — QR could not be read from first photo. "
                      "You can manually rename these folders to the session UUID before uploading.")

    if dry_run:
        console.print("\n[dim]Dry run — no files copied.[/dim]")
        return

    out.mkdir(parents=True, exist_ok=True)
    console.print(f"\nCopying files to [cyan]{out}[/cyan]...")

    from rich.progress import Progress
    with Progress(console=console) as progress:
        total_files = sum(len(g) for _, g in results)
        task = progress.add_task("Copying...", total=total_files)

        for folder_name, group in results:
            dest = out / folder_name
            dest.mkdir(parents=True, exist_ok=True)

            # For unmatched groups, save a small thumbnail of the first photo
            # so the photographer can visually identify the family during upload
            if 'UNMATCHED' in folder_name:
                try:
                    with Image.open(group[0]) as thumb_img:
                        thumb_img.thumbnail((600, 400), Image.LANCZOS)
                        thumb_img.convert('RGB').save(dest / '_preview.jpg', quality=80)
                except Exception:
                    pass
            for img in group:
                shutil.copy2(img, dest / img.name)
                progress.advance(task)

    console.print(f"\n[green]Done.[/green] Staging directory: [cyan]{out.resolve()}[/cyan]")
    console.print("\nNext steps:")
    console.print("  1. Review staging folders — rename UNMATCHED folders to their session UUID")
    console.print("  2. Run: [bold]python scripts/flag_photos.py staging/[/bold]")


if __name__ == '__main__':
    main()
