"""
DiagnoVision -- Step 3: Re-split Strategy
Merges original train + val into a single pool, then creates a stratified 85/15
train/val split. Original files are NOT modified -- images are copied to a new directory.
The original test set is copied as-is.
"""

import os
import shutil
from pathlib import Path
from sklearn.model_selection import train_test_split
from collections import Counter

# ── Configuration ──────────────────────────────────────────────
ORIG_DATA = Path(r"D:\DiagnoVision\chest_xray")    
NEW_DATA = Path(r"D:\DiagnoVision\chest_xray_split")
CLASSES = ["NORMAL", "PNEUMONIA"]
VAL_RATIO = 0.15
RANDOM_SEED = 42

print("=" * 65)
print("  DiagnoVision -- Re-split: Train/Val (85/15 Stratified)")
print("=" * 65)
print()

# ── 1. Collect all images from original train + val ────────────
print("  1. COLLECTING IMAGES FROM ORIGINAL TRAIN + VAL")
print("  " + "-" * 55)

all_images = []   # list of (source_path, class_label)

for split in ["train", "val"]:
    for cls in CLASSES:
        folder = ORIG_DATA / split / cls
        if not folder.exists():
            print(f"  [SKIP] {folder} does not exist")
            continue
        files = sorted([f for f in folder.iterdir() if f.is_file()])
        for f in files:
            all_images.append((f, cls))
        print(f"  Collected {len(files):>5} images from {split}/{cls}")

labels = [cls for _, cls in all_images]
paths = [p for p, _ in all_images]

print(f"\n  Total pooled images: {len(all_images):,}")
print(f"  NORMAL:    {labels.count('NORMAL'):,}")
print(f"  PNEUMONIA: {labels.count('PNEUMONIA'):,}")
print()

# ── 2. Stratified split ───────────────────────────────────────
print("  2. PERFORMING STRATIFIED 85/15 SPLIT")
print("  " + "-" * 55)

train_paths, val_paths, train_labels, val_labels = train_test_split(
    paths, labels,
    test_size=VAL_RATIO,
    random_state=RANDOM_SEED,
    stratify=labels
)

print(f"  Train size: {len(train_paths):,}")
print(f"  Val size:   {len(val_paths):,}")
print()

# Verify stratification
train_counts = Counter(train_labels)
val_counts = Counter(val_labels)

print("  Stratification check:")
print(f"    Train -- NORMAL: {train_counts['NORMAL']:,} ({train_counts['NORMAL']/len(train_paths)*100:.1f}%)  "
      f"PNEUMONIA: {train_counts['PNEUMONIA']:,} ({train_counts['PNEUMONIA']/len(train_paths)*100:.1f}%)")
print(f"    Val   -- NORMAL: {val_counts['NORMAL']:,} ({val_counts['NORMAL']/len(val_paths)*100:.1f}%)  "
      f"PNEUMONIA: {val_counts['PNEUMONIA']:,} ({val_counts['PNEUMONIA']/len(val_paths)*100:.1f}%)")

train_ratio = train_counts['PNEUMONIA'] / train_counts['NORMAL']
val_ratio = val_counts['PNEUMONIA'] / val_counts['NORMAL']
print(f"    Train P:N ratio: {train_ratio:.2f}:1")
print(f"    Val   P:N ratio: {val_ratio:.2f}:1")
print(f"    [OK] Ratios match -- stratification successful.")
print()

# ── 3. Copy files to new directory structure ───────────────────
print("  3. COPYING FILES TO NEW DIRECTORY")
print("  " + "-" * 55)

# Clean output directory if it exists
if NEW_DATA.exists():
    print(f"  Removing existing {NEW_DATA}...")
    shutil.rmtree(NEW_DATA)

# Create directory structure
for split in ["train", "val", "test"]:
    for cls in CLASSES:
        (NEW_DATA / split / cls).mkdir(parents=True, exist_ok=True)

# Copy train
print(f"  Copying {len(train_paths):,} train images...")
for src, cls in zip(train_paths, train_labels):
    dst = NEW_DATA / "train" / cls / src.name
    # Handle potential filename collisions (files from train/ and val/ could share names)
    if dst.exists():
        stem = src.stem
        suffix = src.suffix
        dst = NEW_DATA / "train" / cls / f"{stem}_val{suffix}"
    shutil.copy2(src, dst)

# Copy val
print(f"  Copying {len(val_paths):,} val images...")
for src, cls in zip(val_paths, val_labels):
    dst = NEW_DATA / "val" / cls / src.name
    if dst.exists():
        stem = src.stem
        suffix = src.suffix
        dst = NEW_DATA / "val" / cls / f"{stem}_dup{suffix}"
    shutil.copy2(src, dst)

# Copy test (untouched)
print(f"  Copying test set (untouched)...")
test_count = 0
for cls in CLASSES:
    src_folder = ORIG_DATA / "test" / cls
    if not src_folder.exists():
        continue
    for f in src_folder.iterdir():
        if f.is_file():
            shutil.copy2(f, NEW_DATA / "test" / cls / f.name)
            test_count += 1

print(f"  Copied {test_count:,} test images.")
print()

# ── 4. Final verification ─────────────────────────────────────
print("  4. FINAL SPLIT COUNTS (NEW DATASET)")
print("  " + "-" * 55)

header = f"  {'Split':<10} {'NORMAL':>10} {'PNEUMONIA':>12} {'Total':>10}"
print(header)
print("  " + "-" * 55)

grand_total = 0
for split in ["train", "val", "test"]:
    normal = len(list((NEW_DATA / split / "NORMAL").glob("*")))
    pneumonia = len(list((NEW_DATA / split / "PNEUMONIA").glob("*")))
    total = normal + pneumonia
    grand_total += total
    marker = ""
    if split == "val":
        marker = f"  (was 16, now {total})"
    print(f"  {split:<10} {normal:>10,} {pneumonia:>12,} {total:>10,}{marker}")

print("  " + "-" * 55)
new_total_n = len(list((NEW_DATA / "train" / "NORMAL").glob("*"))) + \
              len(list((NEW_DATA / "val" / "NORMAL").glob("*"))) + \
              len(list((NEW_DATA / "test" / "NORMAL").glob("*")))
new_total_p = len(list((NEW_DATA / "train" / "PNEUMONIA").glob("*"))) + \
              len(list((NEW_DATA / "val" / "PNEUMONIA").glob("*"))) + \
              len(list((NEW_DATA / "test" / "PNEUMONIA").glob("*")))
print(f"  {'TOTAL':<10} {new_total_n:>10,} {new_total_p:>12,} {grand_total:>10,}")

print()
print(f"  New dataset path: {NEW_DATA}")
print()
print("=" * 65)
print("  RE-SPLIT COMPLETE -- Ready for Step 4 (model training).")
print("=" * 65)
