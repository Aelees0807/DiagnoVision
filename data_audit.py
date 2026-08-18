"""
DiagnoVision -- Step 2: Data Audit
Audits the chest_xray dataset for counts, imbalance, corruption, and saves a sample grid.
"""

import os
import sys
from pathlib import Path
from collections import defaultdict
from PIL import Image
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import time

# ── Configuration ──────────────────────────────────────────────
DATA_ROOT = Path(r"D:\DiagnoVision\chest_xray")
SPLITS = ["train", "val", "test"]
CLASSES = ["NORMAL", "PNEUMONIA"]
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".gif"}
GRID_OUTPUT = Path(r"D:\DiagnoVision\sample_grid.png")

print("=" * 65)
print("  DiagnoVision -- Data Audit Report")
print("=" * 65)
print()

# ── 1. Count images per class per split ────────────────────────
print("  1. IMAGE COUNTS PER CLASS PER SPLIT")
print("  " + "-" * 55)

counts = {}  # {split: {class: count}}
all_files = {}  # {split: {class: [file_paths]}}

for split in SPLITS:
    counts[split] = {}
    all_files[split] = {}
    for cls in CLASSES:
        folder = DATA_ROOT / split / cls
        if not folder.exists():
            # Check nested structure (chest_xray/chest_xray/...)
            folder = DATA_ROOT / "chest_xray" / split / cls
        if not folder.exists():
            counts[split][cls] = 0
            all_files[split][cls] = []
            continue
        files = [f for f in folder.iterdir() if f.suffix.lower() in IMAGE_EXTS]
        counts[split][cls] = len(files)
        all_files[split][cls] = files

# Print table
header = f"  {'Split':<10} {'NORMAL':>10} {'PNEUMONIA':>12} {'Total':>10}"
print(header)
print("  " + "-" * 55)

grand_total = 0
for split in SPLITS:
    normal = counts[split].get("NORMAL", 0)
    pneumonia = counts[split].get("PNEUMONIA", 0)
    total = normal + pneumonia
    grand_total += total
    print(f"  {split:<10} {normal:>10,} {pneumonia:>12,} {total:>10,}")

print("  " + "-" * 55)
total_normal = sum(counts[s].get("NORMAL", 0) for s in SPLITS)
total_pneumonia = sum(counts[s].get("PNEUMONIA", 0) for s in SPLITS)
print(f"  {'TOTAL':<10} {total_normal:>10,} {total_pneumonia:>12,} {grand_total:>10,}")
print()

# ── 2. Class imbalance in train set ───────────────────────────
print("  2. CLASS IMBALANCE (TRAIN SET)")
print("  " + "-" * 55)

train_normal = counts["train"].get("NORMAL", 0)
train_pneumonia = counts["train"].get("PNEUMONIA", 0)

if train_normal > 0 and train_pneumonia > 0:
    ratio = train_pneumonia / train_normal
    print(f"  NORMAL count     : {train_normal:,}")
    print(f"  PNEUMONIA count  : {train_pneumonia:,}")
    print(f"  Ratio (P:N)      : {ratio:.2f}:1")
    print(f"  NORMAL %         : {train_normal / (train_normal + train_pneumonia) * 100:.1f}%")
    print(f"  PNEUMONIA %      : {train_pneumonia / (train_normal + train_pneumonia) * 100:.1f}%")
    
    if ratio > 2.0:
        print(f"  [WARNING] Significant imbalance detected! PNEUMONIA is {ratio:.1f}x NORMAL.")
        print(f"            Consider: weighted loss, oversampling, or augmentation for NORMAL.")
    elif ratio < 0.5:
        print(f"  [WARNING] Significant imbalance detected! NORMAL is {1/ratio:.1f}x PNEUMONIA.")
    else:
        print(f"  [OK] Classes are reasonably balanced.")
else:
    print("  [ERROR] One or both classes have zero images!")
print()

# ── 3. Validation set size flag ───────────────────────────────
print("  3. VALIDATION SET SIZE CHECK")
print("  " + "-" * 55)

val_normal = counts["val"].get("NORMAL", 0)
val_pneumonia = counts["val"].get("PNEUMONIA", 0)
val_total = val_normal + val_pneumonia

print(f"  Val NORMAL       : {val_normal}")
print(f"  Val PNEUMONIA    : {val_pneumonia}")
print(f"  Val TOTAL        : {val_total}")

if val_total < 100:
    print(f"  [WARNING] Validation set is very small ({val_total} images)!")
    print(f"            This is too few for reliable metric estimation.")
    print(f"            Recommendation: merge val into train and use a")
    print(f"            stratified split (e.g., 80/20) to create a larger val set.")
elif val_total < 500:
    print(f"  [CAUTION] Validation set is relatively small ({val_total} images).")
else:
    print(f"  [OK] Validation set size is adequate.")
print()

# ── 4. Check for corrupted / unreadable files ─────────────────
print("  4. CORRUPTION CHECK (scanning all images...)")
print("  " + "-" * 55)

corrupted = []
total_checked = 0
start_time = time.time()

for split in SPLITS:
    for cls in CLASSES:
        for fpath in all_files[split][cls]:
            total_checked += 1
            try:
                with Image.open(fpath) as img:
                    img.verify()  # Verify without fully loading
            except Exception as e:
                corrupted.append((split, cls, fpath.name, str(e)))
            
            # Also try loading to catch truncated images
            try:
                with Image.open(fpath) as img:
                    img.load()  # Force full decode
            except Exception as e:
                entry = (split, cls, fpath.name, str(e))
                if entry not in corrupted:
                    corrupted.append(entry)

elapsed = time.time() - start_time
print(f"  Images scanned   : {total_checked:,}")
print(f"  Scan time        : {elapsed:.1f}s")

if corrupted:
    print(f"  [WARNING] Found {len(corrupted)} corrupted/unreadable file(s):")
    for split, cls, fname, err in corrupted[:20]:  # Show max 20
        print(f"    - {split}/{cls}/{fname}: {err[:60]}")
    if len(corrupted) > 20:
        print(f"    ... and {len(corrupted) - 20} more.")
else:
    print(f"  [OK] No corrupted images found.")
print()

# ── 5. Sample grid visualization ──────────────────────────────
print("  5. GENERATING SAMPLE GRID")
print("  " + "-" * 55)

N_SAMPLES = 4  # per class

fig, axes = plt.subplots(2, N_SAMPLES, figsize=(16, 8))
fig.suptitle("DiagnoVision -- Sample X-Ray Grid", fontsize=16, fontweight="bold", y=0.98)

for row, cls in enumerate(CLASSES):
    # Pick samples from train set
    sample_files = all_files["train"][cls][:N_SAMPLES]
    
    for col, fpath in enumerate(sample_files):
        ax = axes[row, col]
        try:
            img = Image.open(fpath).convert("L")  # Grayscale
            ax.imshow(np.array(img), cmap="gray")
            ax.set_title(f"{cls}\n{img.size[0]}x{img.size[1]}", fontsize=10)
        except Exception as e:
            ax.text(0.5, 0.5, f"ERROR\n{e}", ha="center", va="center", transform=ax.transAxes)
            ax.set_title(cls, fontsize=10)
        ax.axis("off")

# Add row labels
axes[0, 0].set_ylabel("NORMAL", fontsize=13, fontweight="bold", rotation=0, labelpad=80, va="center")
axes[1, 0].set_ylabel("PNEUMONIA", fontsize=13, fontweight="bold", rotation=0, labelpad=80, va="center")

plt.tight_layout(rect=[0.08, 0, 1, 0.95])
plt.savefig(GRID_OUTPUT, dpi=150, bbox_inches="tight", facecolor="white")
plt.close()
print(f"  Sample grid saved to: {GRID_OUTPUT}")
print()

# ── Summary ────────────────────────────────────────────────────
print("=" * 65)
print("  AUDIT COMPLETE -- Review results above before proceeding.")
print("=" * 65)
