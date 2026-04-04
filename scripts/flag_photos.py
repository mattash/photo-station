#!/usr/bin/env python3
"""
flag_photos.py — Scan staged photo groups for quality issues and generate an HTML review gallery.

Checks each photo for:
  - Blur (Laplacian variance < 80)
  - Underexposure (mean brightness < 50)
  - Overexposure (mean brightness > 210)

Output: staging/review.html — a gallery organized by session folder, with
red borders on flagged photos and the reason displayed below each.

Usage:
  python scripts/flag_photos.py staging/ [--open]

Requirements:
  pip install -r scripts/requirements.txt
"""

import os
import base64
import io
import webbrowser
from pathlib import Path

import click
from PIL import Image, ImageStat, ImageFilter
from rich.console import Console
from rich.progress import track

console = Console()

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.heic', '.heif', '.tiff', '.tif'}

BLUR_THRESHOLD = 80
DARK_THRESHOLD = 50
BRIGHT_THRESHOLD = 210

THUMB_SIZE = (300, 225)


def laplacian_variance(img: Image.Image) -> float:
    """Compute blur score via Laplacian variance. Lower = blurrier."""
    gray = img.convert('L')
    filtered = gray.filter(ImageFilter.Kernel(
        size=(3, 3),
        kernel=[-1, -1, -1, -1, 8, -1, -1, -1, -1],
        scale=1,
        offset=128,
    ))
    stat = ImageStat.Stat(filtered)
    return stat.var[0]


def mean_brightness(img: Image.Image) -> float:
    """Return mean pixel brightness (0–255)."""
    gray = img.convert('L')
    return ImageStat.Stat(gray).mean[0]


def check_photo(path: Path) -> list[str]:
    """Return list of quality issue strings, or empty list if ok."""
    issues = []
    try:
        with Image.open(path) as img:
            img.load()
            rgb = img.convert('RGB')
            blur = laplacian_variance(rgb)
            brightness = mean_brightness(rgb)
            if blur < BLUR_THRESHOLD:
                issues.append(f'blurry (score {blur:.0f})')
            if brightness < DARK_THRESHOLD:
                issues.append(f'underexposed (brightness {brightness:.0f})')
            elif brightness > BRIGHT_THRESHOLD:
                issues.append(f'overexposed (brightness {brightness:.0f})')
    except Exception as e:
        issues.append(f'error: {e}')
    return issues


def make_thumbnail_data_url(path: Path) -> str:
    """Return base64-encoded data URL for inline HTML embedding."""
    try:
        with Image.open(path) as img:
            img.thumbnail(THUMB_SIZE, Image.LANCZOS)
            buf = io.BytesIO()
            img.convert('RGB').save(buf, format='JPEG', quality=75)
            b64 = base64.b64encode(buf.getvalue()).decode()
            return f'data:image/jpeg;base64,{b64}'
    except Exception:
        return ''


def build_html(groups: dict[str, list[tuple[Path, list[str]]]]) -> str:
    total_photos = sum(len(v) for v in groups.values())
    total_flagged = sum(1 for v in groups.values() for _, issues in v if issues)

    group_html = ''
    for folder_name, photos in sorted(groups.items()):
        flagged_in_group = sum(1 for _, issues in photos if issues)
        group_html += f'''
    <div class="group">
      <div class="group-header">
        <span class="group-name">{folder_name}</span>
        <span class="group-stats">{len(photos)} photos'''
        if flagged_in_group:
            group_html += f' · <span class="flag-count">{flagged_in_group} flagged</span>'
        group_html += '</span></div>\n      <div class="photo-grid">\n'

        for photo_path, issues in photos:
            thumb = make_thumbnail_data_url(photo_path)
            flagged = bool(issues)
            card_class = 'photo-card flagged' if flagged else 'photo-card ok'
            issue_html = f'<div class="issues">{", ".join(issues)}</div>' if issues else ''
            group_html += f'''        <div class="{card_class}">
          <img src="{thumb}" alt="{photo_path.name}" loading="lazy" />
          <div class="photo-name">{photo_path.name}</div>
          {issue_html}
        </div>\n'''

        group_html += '      </div>\n    </div>\n'

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Photo Review</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f5f5f5; color: #333; padding: 24px; }}
    h1 {{ font-size: 1.5rem; margin-bottom: 4px; }}
    .summary {{ color: #666; font-size: 0.9rem; margin-bottom: 24px; }}
    .flag-count {{ color: #dc2626; font-weight: 600; }}
    .group {{ background: white; border-radius: 12px; border: 1px solid #e5e7eb;
              margin-bottom: 24px; overflow: hidden; }}
    .group-header {{ display: flex; align-items: center; justify-content: space-between;
                     padding: 12px 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }}
    .group-name {{ font-weight: 600; font-size: 0.95rem; font-family: monospace; }}
    .group-stats {{ font-size: 0.85rem; color: #6b7280; }}
    .photo-grid {{ display: flex; flex-wrap: wrap; gap: 12px; padding: 16px; }}
    .photo-card {{ width: 180px; border-radius: 8px; overflow: hidden;
                   border: 3px solid transparent; }}
    .photo-card.ok {{ border-color: #22c55e; }}
    .photo-card.flagged {{ border-color: #ef4444; }}
    .photo-card img {{ width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }}
    .photo-name {{ font-size: 0.7rem; color: #6b7280; padding: 4px 6px;
                   white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    .issues {{ font-size: 0.7rem; color: #dc2626; padding: 0 6px 6px;
               font-weight: 500; }}
  </style>
</head>
<body>
  <h1>Photo Review</h1>
  <p class="summary">{total_photos} photos across {len(groups)} sessions
    · <span class="flag-count">{total_flagged} flagged</span>
    · Delete flagged photos you don&apos;t want before uploading</p>
  {group_html}
</body>
</html>'''


@click.command()
@click.argument('staging', type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option('--open', 'open_browser', is_flag=True, help='Open review.html in browser when done')
@click.option('--blur-threshold', default=BLUR_THRESHOLD, show_default=True, help='Laplacian variance below this = blurry')
@click.option('--dark-threshold', default=DARK_THRESHOLD, show_default=True, help='Mean brightness below this = underexposed')
@click.option('--bright-threshold', default=BRIGHT_THRESHOLD, show_default=True, help='Mean brightness above this = overexposed')
def main(staging: Path, open_browser: bool, blur_threshold: int, dark_threshold: int, bright_threshold: int):
    """Scan staged photo groups for quality issues and generate review.html.

    STAGING is the directory produced by group_photos.py, containing one
    subfolder per session.
    """
    global BLUR_THRESHOLD, DARK_THRESHOLD, BRIGHT_THRESHOLD
    BLUR_THRESHOLD = blur_threshold
    DARK_THRESHOLD = dark_threshold
    BRIGHT_THRESHOLD = bright_threshold

    # Collect session subfolders
    session_dirs = sorted([d for d in staging.iterdir() if d.is_dir()])
    if not session_dirs:
        console.print(f"[red]No subdirectories found in {staging}[/red]")
        return

    console.print(f"Scanning [bold]{len(session_dirs)}[/bold] session folders in [cyan]{staging}[/cyan]...\n")

    groups: dict[str, list[tuple[Path, list[str]]]] = {}

    for session_dir in track(session_dirs, description="Analyzing photos..."):
        images = sorted([
            p for p in session_dir.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
        ])
        if not images:
            continue
        photo_results = [(img, check_photo(img)) for img in images]
        groups[session_dir.name] = photo_results

    total = sum(len(v) for v in groups.values())
    flagged = sum(1 for v in groups.values() for _, issues in v if issues)
    console.print(f"\n[bold]{total}[/bold] photos analyzed · [red]{flagged} flagged[/red]\n")
    console.print("Building review gallery (embedding thumbnails)...")

    html = build_html(groups)
    output_path = staging / 'review.html'
    output_path.write_text(html, encoding='utf-8')

    console.print(f"[green]Saved:[/green] {output_path.resolve()}")
    console.print("\nNext steps:")
    console.print("  1. Review the gallery — delete flagged photos you don't want")
    console.print("  2. Edit/enhance remaining photos in Lightroom, Photos, etc.")
    console.print("  3. Run: [bold]python scripts/upload_photos.py staging/[/bold]")

    if open_browser:
        webbrowser.open(output_path.resolve().as_uri())


if __name__ == '__main__':
    main()
