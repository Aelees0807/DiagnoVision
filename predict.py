"""
DiagnoVision -- Single Image Prediction
Predict NORMAL or PNEUMONIA from a single chest X-ray image.

Usage:
    C:/anaconda/python.exe predict.py <path_to_xray_image>

Examples:
    C:/anaconda/python.exe predict.py D:/DiagnoVision/chest_xray_split/test/NORMAL/IM-0001-0001.jpeg
    C:/anaconda/python.exe predict.py D:/DiagnoVision/chest_xray_split/test/PNEUMONIA/person1_virus_6.jpeg
    C:/anaconda/python.exe predict.py C:/Users/my_xray.jpg
"""

import sys
from pathlib import Path

import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image

# ── Configuration ──────────────────────────────────────────────
CHECKPOINT_PATH = Path(r"D:\DiagnoVision\checkpoints\best_model.pth")
IMAGE_SIZE = 224
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
CLASS_NAMES = ["NORMAL", "PNEUMONIA"]


def load_model(device):
    """Load EfficientNet-B0 with best checkpoint."""
    model = models.efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(512, 2)
    )
    checkpoint = torch.load(CHECKPOINT_PATH, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)
    model.eval()
    return model


def predict_image(image_path, model, device):
    """Run prediction on a single image."""
    transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    # Load and preprocess
    img = Image.open(image_path).convert("RGB")
    img_tensor = transform(img).unsqueeze(0).to(device)  # Add batch dimension

    # Predict
    with torch.no_grad():
        output = model(img_tensor)
        probs = torch.softmax(output, dim=1)
        confidence, predicted = probs.max(1)

    pred_class = CLASS_NAMES[predicted.item()]
    conf = confidence.item() * 100
    normal_prob = probs[0][0].item() * 100
    pneumonia_prob = probs[0][1].item() * 100

    return pred_class, conf, normal_prob, pneumonia_prob


def main():
    if len(sys.argv) < 2:
        print()
        print("  DiagnoVision -- Single Image Prediction")
        print("  " + "=" * 50)
        print()
        print("  Usage:")
        print("    C:\\anaconda\\python.exe predict.py <path_to_image>")
        print()
        print("  Examples:")
        print("    C:\\anaconda\\python.exe predict.py chest_xray_split\\test\\NORMAL\\IM-0001-0001.jpeg")
        print("    C:\\anaconda\\python.exe predict.py C:\\path\\to\\my_xray.jpg")
        print()
        sys.exit(1)

    image_path = Path(sys.argv[1])

    if not image_path.exists():
        print(f"  [ERROR] Image not found: {image_path}")
        sys.exit(1)

    print()
    print("  DiagnoVision -- Single Image Prediction")
    print("  " + "=" * 50)
    print()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Loading model... ", end="", flush=True)
    model = load_model(device)
    print("done.")
    print()

    print(f"  Image: {image_path}")
    print(f"  " + "-" * 50)

    pred_class, conf, normal_prob, pneumonia_prob = predict_image(image_path, model, device)

    print()
    print(f"  Prediction:   {pred_class}")
    print(f"  Confidence:   {conf:.1f}%")
    print()
    print(f"  Probabilities:")
    print(f"    NORMAL:     {normal_prob:.1f}%  {'<<' if normal_prob > pneumonia_prob else ''}")
    print(f"    PNEUMONIA:  {pneumonia_prob:.1f}%  {'<<' if pneumonia_prob > normal_prob else ''}")
    print()

    if pred_class == "PNEUMONIA":
        print("  [!] PNEUMONIA DETECTED -- Recommend clinical follow-up.")
    else:
        print("  [OK] No pneumonia indicators detected.")

    print()


if __name__ == "__main__":
    main()
