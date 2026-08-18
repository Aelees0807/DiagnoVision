"""
DiagnoVision -- Step 9: Gatekeeper Data Preparation
Prepares balanced binary dataset: "chest_xray" vs "not_chest_xray"
for the out-of-distribution gatekeeper classifier.

Positive samples: chest X-rays from existing training data
Negative samples: bone fracture X-rays (elbow, finger, forearm, etc.)
                  + synthetic non-medical images (noise, gradients, solids)
"""

import os
import random
import shutil
from pathlib import Path
from collections import Counter

import numpy as np
from PIL import Image
from sklearn.model_selection import train_test_split

# ── Configuration ──────────────────────────────────────────────
CHEST_XRAY_DIR  = Path(r"D:\DiagnoVision\chest_xray_split\train")
BONE_DATA_DIR   = Path(r"D:\DiagnoVision\bone_fracture_data\BoneFractureYolo8")
OUTPUT_DIR      = Path(r"D:\DiagnoVision\gatekeeper_split")
RANDOM_SEED     = 42
VAL_RATIO       = 0.15
SAMPLES_PER_CLASS = 600   # Target per class (balanced)
NUM_SYNTHETIC   = 60      # Non-medical synthetic images

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


def collect_images(directory, extensions=(".jpg", ".jpeg", ".png", ".bmp")):
    """Recursively collect all image files from a directory."""
    images = []
    for root, _, files in os.walk(directory):
        for f in files:
            if f.lower().endswith(extensions):
                images.append(Path(root) / f)
    return sorted(images)


def generate_synthetic_images(output_dir, count):
    """Generate synthetic non-medical images (noise, gradients, solid colors)."""
    output_dir.mkdir(parents=True, exist_ok=True)
    generated = []

    for i in range(count):
        img_type = i % 3  # Cycle through types

        if img_type == 0:
            # Random noise
            arr = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)
            img = Image.fromarray(arr)
        elif img_type == 1:
            # Solid color
            color = tuple(np.random.randint(0, 256, 3))
            img = Image.new("RGB", (224, 224), color)
        else:
            # Gradient
            arr = np.zeros((224, 224, 3), dtype=np.uint8)
            for y in range(224):
                val = int(y / 224 * 255)
                arr[y, :, :] = [val, 255 - val, 128]
            # Add some random rotation/variation
            angle = np.random.uniform(-45, 45)
            img = Image.fromarray(arr).rotate(angle, fillcolor=(0, 0, 0))

        path = output_dir / f"synthetic_{i:04d}.png"
        img.save(path)
        generated.append(path)

    return generated


def main():
    print("=" * 70)
    print("  DiagnoVision -- Step 9: Gatekeeper Data Preparation")
    print("=" * 70)
    print()

    # ── 1. Collect chest X-ray images (positive) ──────────────
    print("  1. COLLECTING CHEST X-RAY IMAGES (POSITIVE CLASS)")
    print("  " + "-" * 60)

    chest_normal = collect_images(CHEST_XRAY_DIR / "NORMAL")
    chest_pneumonia = collect_images(CHEST_XRAY_DIR / "PNEUMONIA")
    all_chest = chest_normal + chest_pneumonia

    print(f"  NORMAL:    {len(chest_normal)}")
    print(f"  PNEUMONIA: {len(chest_pneumonia)}")
    print(f"  Total:     {len(all_chest)}")

    # Sample balanced chest X-rays
    random.shuffle(all_chest)
    chest_sample = all_chest[:SAMPLES_PER_CLASS]
    print(f"  Sampled:   {len(chest_sample)} chest X-rays")
    print()

    # ── 2. Collect non-chest X-ray images (negative) ──────────
    print("  2. COLLECTING NON-CHEST X-RAY IMAGES (NEGATIVE CLASS)")
    print("  " + "-" * 60)

    # Collect from all splits of the bone fracture dataset
    bone_images = []
    for split in ["train", "valid", "test"]:
        imgs = collect_images(BONE_DATA_DIR / split / "images")
        bone_images.extend(imgs)
        print(f"  Bone fracture {split:>5}: {len(imgs)} images")

    print(f"  Total bone images: {len(bone_images)}")

    # Sample bone fracture images
    random.shuffle(bone_images)
    bone_target = SAMPLES_PER_CLASS - NUM_SYNTHETIC
    bone_sample = bone_images[:bone_target]
    print(f"  Sampled:   {len(bone_sample)} bone fracture X-rays")
    print()

    # ── 3. Generate synthetic non-medical images ──────────────
    print("  3. GENERATING SYNTHETIC NON-MEDICAL IMAGES")
    print("  " + "-" * 60)

    synthetic_dir = OUTPUT_DIR / "_synthetic_temp"
    synthetic_images = generate_synthetic_images(synthetic_dir, NUM_SYNTHETIC)
    print(f"  Generated: {len(synthetic_images)} synthetic images")
    print(f"    (noise, solid colors, gradients)")
    print()

    # Combine all negative samples
    all_negative = bone_sample + synthetic_images
    random.shuffle(all_negative)
    print(f"  Total negative samples: {len(all_negative)}")
    print()

    # ── 4. Create train/val split ─────────────────────────────
    print("  4. STRATIFIED TRAIN/VAL SPLIT")
    print("  " + "-" * 60)

    # Combine with labels
    all_paths = chest_sample + all_negative
    all_labels = ["chest_xray"] * len(chest_sample) + ["not_chest_xray"] * len(all_negative)

    train_paths, val_paths, train_labels, val_labels = train_test_split(
        all_paths, all_labels,
        test_size=VAL_RATIO,
        random_state=RANDOM_SEED,
        stratify=all_labels
    )

    print(f"  Total:  {len(all_paths)}")
    print(f"  Train:  {len(train_paths)}")
    print(f"  Val:    {len(val_paths)}")

    train_counts = Counter(train_labels)
    val_counts = Counter(val_labels)
    print(f"  Train -- chest_xray: {train_counts['chest_xray']}, not_chest_xray: {train_counts['not_chest_xray']}")
    print(f"  Val   -- chest_xray: {val_counts['chest_xray']}, not_chest_xray: {val_counts['not_chest_xray']}")
    print()

    # ── 5. Copy files to output directory ─────────────────────
    print("  5. COPYING FILES TO GATEKEEPER DATASET")
    print("  " + "-" * 60)

    # Clean output directory
    if OUTPUT_DIR.exists():
        # Only remove the split dirs, not synthetic temp
        for split in ["train", "val"]:
            split_dir = OUTPUT_DIR / split
            if split_dir.exists():
                shutil.rmtree(split_dir)

    # Create directory structure
    for split in ["train", "val"]:
        for cls in ["chest_xray", "not_chest_xray"]:
            (OUTPUT_DIR / split / cls).mkdir(parents=True, exist_ok=True)

    # Copy train
    print(f"  Copying {len(train_paths)} train images...")
    name_counter = Counter()
    for src, label in zip(train_paths, train_labels):
        src = Path(src)
        dst_name = src.name
        dst = OUTPUT_DIR / "train" / label / dst_name
        if dst.exists():
            name_counter[dst_name] += 1
            stem = src.stem
            suffix = src.suffix
            dst = OUTPUT_DIR / "train" / label / f"{stem}_{name_counter[dst_name]}{suffix}"
        shutil.copy2(src, dst)

    # Copy val
    print(f"  Copying {len(val_paths)} val images...")
    name_counter = Counter()
    for src, label in zip(val_paths, val_labels):
        src = Path(src)
        dst_name = src.name
        dst = OUTPUT_DIR / "val" / label / dst_name
        if dst.exists():
            name_counter[dst_name] += 1
            stem = src.stem
            suffix = src.suffix
            dst = OUTPUT_DIR / "val" / label / f"{stem}_{name_counter[dst_name]}{suffix}"
        shutil.copy2(src, dst)

    # Clean up synthetic temp
    if synthetic_dir.exists():
        shutil.rmtree(synthetic_dir)

    print()

    # ── 6. Final verification ─────────────────────────────────
    print("  6. FINAL DATASET COUNTS")
    print("  " + "-" * 60)

    header = f"  {'Split':<10} {'chest_xray':>12} {'not_chest_xray':>16} {'Total':>10}"
    print(header)
    print("  " + "-" * 55)

    grand_total = 0
    for split in ["train", "val"]:
        chest = len(list((OUTPUT_DIR / split / "chest_xray").glob("*")))
        not_chest = len(list((OUTPUT_DIR / split / "not_chest_xray").glob("*")))
        total = chest + not_chest
        grand_total += total
        print(f"  {split:<10} {chest:>12} {not_chest:>16} {total:>10}")

    print("  " + "-" * 55)
    print(f"  {'TOTAL':<10} {'':>12} {'':>16} {grand_total:>10}")
    print()

    print(f"  Dataset path: {OUTPUT_DIR}")
    print()
    print("=" * 70)
    print("  GATEKEEPER DATA PREPARATION COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
