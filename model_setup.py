"""
DiagnoVision -- Step 5: Model Setup
Loads pretrained EfficientNet-B0, freezes early layers, replaces classification
head for binary output, and verifies VRAM usage with a forward pass.
"""

import torch
import torch.nn as nn
from torchvision import models
import gc

def main():
    print("=" * 65)
    print("  DiagnoVision -- Step 5: Model Setup")
    print("=" * 65)
    print()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device: {device}")
    print()

    # ── 1. Load Pretrained EfficientNet-B0 ─────────────────────
    print("  1. LOADING PRETRAINED EFFICIENTNET-B0")
    print("  " + "-" * 55)

    # Clear GPU memory before starting
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()

    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1)

    # Print original architecture summary
    total_params = sum(p.numel() for p in model.parameters())
    print(f"  Model: EfficientNet-B0")
    print(f"  Pretrained on: ImageNet-1K")
    print(f"  Total parameters (original): {total_params:,}")
    print()

    # ── 2. Freeze Early Layers ─────────────────────────────────
    print("  2. FREEZING EARLY LAYERS")
    print("  " + "-" * 55)

    # EfficientNet-B0 architecture:
    #   model.features  -> 9 blocks (0-8) of convolutional layers
    #   model.avgpool   -> adaptive average pooling
    #   model.classifier -> final FC layer
    #
    # Strategy: Freeze the feature extractor (blocks 0-5), keep blocks 6-8
    # and the classifier trainable. This preserves low-level features
    # (edges, textures) learned from ImageNet while allowing the deeper
    # layers to adapt to X-ray-specific patterns.

    # Freeze all feature extractor layers first
    for param in model.features.parameters():
        param.requires_grad = False

    # Unfreeze the last 3 blocks (6, 7, 8) for fine-tuning
    for block_idx in [6, 7, 8]:
        for param in model.features[block_idx].parameters():
            param.requires_grad = True

    frozen_params = sum(p.numel() for p in model.parameters() if not p.requires_grad)
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)

    print(f"  Frozen layers:    features[0] through features[5]")
    print(f"  Trainable layers: features[6], features[7], features[8], classifier")
    print(f"  Frozen params:    {frozen_params:,}")
    print(f"  Trainable params: {trainable_params:,}")
    print(f"  Trainable ratio:  {trainable_params / total_params * 100:.1f}%")
    print()

    # ── 3. Replace Classification Head ─────────────────────────
    print("  3. REPLACING CLASSIFICATION HEAD")
    print("  " + "-" * 55)

    # Original classifier: Linear(1280, 1000) for ImageNet 1000 classes
    print(f"  Original classifier: {model.classifier}")

    # Replace with binary classification head
    # Using dropout for regularization + single output neuron
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(512, 2)   # 2 classes: NORMAL, PNEUMONIA
    )

    print(f"  New classifier: {model.classifier}")
    print()

    # Recalculate params after head replacement
    new_total = sum(p.numel() for p in model.parameters())
    new_trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  New total params:     {new_total:,}")
    print(f"  New trainable params: {new_trainable:,}")
    print()

    # ── 4. Print Layer-by-Layer Freeze Status ──────────────────
    print("  4. LAYER FREEZE STATUS")
    print("  " + "-" * 55)

    for i, block in enumerate(model.features):
        block_params = sum(p.numel() for p in block.parameters())
        block_trainable = sum(p.numel() for p in block.parameters() if p.requires_grad)
        status = "TRAINABLE" if block_trainable > 0 else "FROZEN"
        print(f"    features[{i}]: {status:>10}  ({block_params:>10,} params)")

    cls_params = sum(p.numel() for p in model.classifier.parameters())
    print(f"    classifier:  {'TRAINABLE':>10}  ({cls_params:>10,} params)")
    print()

    # ── 5. Forward Pass & VRAM Check ───────────────────────────
    print("  5. FORWARD PASS & VRAM CHECK")
    print("  " + "-" * 55)

    BATCH_SIZE = 32

    # Move model to GPU
    model = model.to(device)
    model.eval()

    # Clear and reset VRAM tracking
    torch.cuda.empty_cache()
    gc.collect()
    torch.cuda.reset_peak_memory_stats()

    vram_before = torch.cuda.memory_allocated() / (1024 ** 2)
    print(f"  VRAM after model load: {vram_before:.1f} MB")

    # Create dummy batch matching our pipeline: [batch, 3, 224, 224]
    dummy_input = torch.randn(BATCH_SIZE, 3, 224, 224, device=device)

    # Forward pass (no gradients for inference check)
    with torch.no_grad():
        output = model(dummy_input)

    vram_after_inference = torch.cuda.memory_allocated() / (1024 ** 2)
    peak_vram_inference = torch.cuda.max_memory_allocated() / (1024 ** 2)

    print(f"  VRAM after inference:  {vram_after_inference:.1f} MB")
    print(f"  Peak VRAM (inference): {peak_vram_inference:.1f} MB")
    print(f"  Output shape:          {output.shape}")
    print()

    # Now simulate a TRAINING forward+backward pass (this uses more VRAM)
    print("  Simulating training pass (forward + backward)...")
    model.train()
    torch.cuda.empty_cache()
    gc.collect()
    torch.cuda.reset_peak_memory_stats()

    dummy_input = torch.randn(BATCH_SIZE, 3, 224, 224, device=device)
    dummy_labels = torch.randint(0, 2, (BATCH_SIZE,), device=device)

    # Class weights from Step 4
    class_weights = torch.FloatTensor([1.9385, 0.6738]).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    # Forward
    output = model(dummy_input)
    loss = criterion(output, dummy_labels)

    # Backward
    loss.backward()

    vram_training = torch.cuda.memory_allocated() / (1024 ** 2)
    peak_vram_training = torch.cuda.max_memory_allocated() / (1024 ** 2)
    total_vram = torch.cuda.get_device_properties(0).total_memory / (1024 ** 2)

    print(f"  VRAM after train step:  {vram_training:.1f} MB")
    print(f"  Peak VRAM (training):   {peak_vram_training:.1f} MB")
    print(f"  Total GPU VRAM:         {total_vram:.0f} MB")
    print(f"  VRAM utilization:       {peak_vram_training / total_vram * 100:.1f}%")
    print(f"  VRAM headroom:          {total_vram - peak_vram_training:.0f} MB")
    print()

    # Verdict
    if peak_vram_training < total_vram * 0.85:
        print(f"  [OK] Fits comfortably in 6 GB VRAM!")
        print(f"       Batch size {BATCH_SIZE} is safe for training.")
    elif peak_vram_training < total_vram * 0.95:
        print(f"  [CAUTION] Tight fit. Consider reducing batch size to 16.")
    else:
        print(f"  [WARNING] May OOM during training. Reduce batch size to 16 or 8.")

    # Cleanup
    del dummy_input, dummy_labels, output, loss
    torch.cuda.empty_cache()
    gc.collect()
    print()

    # ── Summary ────────────────────────────────────────────────
    print("=" * 65)
    print("  MODEL SETUP COMPLETE")
    print(f"  - Architecture:  EfficientNet-B0 (pretrained ImageNet)")
    print(f"  - Frozen:        features[0-5] ({frozen_params:,} params)")
    print(f"  - Trainable:     features[6-8] + classifier ({new_trainable:,} params)")
    print(f"  - Output:        2 classes (NORMAL=0, PNEUMONIA=1)")
    print(f"  - Batch size:    {BATCH_SIZE}")
    print(f"  - Peak VRAM:     {peak_vram_training:.0f} MB / {total_vram:.0f} MB")
    print("=" * 65)


if __name__ == "__main__":
    main()
