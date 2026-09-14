"""
DiagnoVision -- Single Image Prediction
Predict NORMAL or PNEUMONIA from a single chest X-ray image.
Includes a gatekeeper check to reject non-chest X-ray images.

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
PNEUMONIA_CHECKPOINT_PATH = Path(r"D:\DiagnoVision\checkpoints\best_model.pth")
GATEKEEPER_CHECKPOINT_PATH = Path(r"D:\DiagnoVision\checkpoints\gatekeeper_best.pth")
IMAGE_SIZE = 224
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
CLASS_NAMES = ["NORMAL", "PNEUMONIA"]


def load_pneumonia_model(device):
    """Load EfficientNet-B0 with best pneumonia checkpoint."""
    model = models.efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(512, 2)
    )
    checkpoint = torch.load(PNEUMONIA_CHECKPOINT_PATH, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)
    model.eval()
    return model

def load_gatekeeper_model(device):
    """Load MobileNetV3-Small with gatekeeper checkpoint."""
    model = models.mobilenet_v3_small(weights=None)
    in_features = model.classifier[0].in_features
    model.classifier = nn.Sequential(
        nn.Linear(in_features, 256),
        nn.Hardswish(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(256, 2)
    )
    checkpoint = torch.load(GATEKEEPER_CHECKPOINT_PATH, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)
    model.eval()
    return model


def predict_gatekeeper(image_path, model, device):
    """Run gatekeeper prediction to check if image is a chest X-ray."""
    transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    img = Image.open(image_path).convert("RGB")
    img_tensor = transform(img).unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(img_tensor)
        probs = torch.softmax(output, dim=1)
        pred_idx = output.argmax(dim=1).item()
        confidence = probs[0, pred_idx].item() * 100

    classes = ["chest_xray", "not_chest_xray"]
    return classes[pred_idx], confidence


def predict_pneumonia(image_path, model, device):
    """Run prediction on a single image for pneumonia."""
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
    print(f"  Loading models... ", end="", flush=True)
    gatekeeper_model = load_gatekeeper_model(device)
    pneumonia_model = load_pneumonia_model(device)
    print("done.")
    print()

    print(f"  Image: {image_path}")
    print(f"  " + "-" * 50)
    print()

    print(f"  [Gatekeeper Check]")
    gatekeeper_class, gatekeeper_conf = predict_gatekeeper(image_path, gatekeeper_model, device)
    
    if gatekeeper_class == "not_chest_xray":
        print(f"  Result:     REJECTED (Not a chest X-ray)")
        print(f"  Confidence: {gatekeeper_conf:.1f}%")
        print()
        print("  [X] This image does not appear to be a frontal chest X-ray.")
        print("      Pneumonia prediction is aborted to prevent false results.")
        print()
        return
        
    print(f"  Result:     PASSED (Chest X-ray confirmed)")
    print(f"  Confidence: {gatekeeper_conf:.1f}%")
    print()

    print(f"  [Pneumonia Prediction]")
    pred_class, conf, normal_prob, pneumonia_prob = predict_pneumonia(image_path, pneumonia_model, device)

    CONFIDENCE_THRESHOLD = 70.0  # matches project's 0.7 threshold

    print(f"  Probabilities:")
    print(f"    NORMAL:     {normal_prob:.1f}%  {'<<' if normal_prob > pneumonia_prob else ''}")
    print(f"    PNEUMONIA:  {pneumonia_prob:.1f}%  {'<<' if pneumonia_prob > normal_prob else ''}")
    print()

    if conf < CONFIDENCE_THRESHOLD:
        print(f"  [?] UNCERTAIN -- Confidence ({conf:.1f}%) below threshold ({CONFIDENCE_THRESHOLD:.0f}%).")
        print("      Recommend professional review rather than relying on this prediction.")
    elif pred_class == "PNEUMONIA":
        print(f"  [!] Screening result: SIGNS CONSISTENT WITH PNEUMONIA (confidence {conf:.1f}%)")
        print("      This is an AI-assisted screening result, not a diagnosis -- recommend clinical follow-up.")
    else:
        print(f"  [OK] Screening result: NO PNEUMONIA INDICATORS DETECTED (confidence {conf:.1f}%)")
        print("      This is an AI-assisted screening result, not a diagnosis.")

    print()


if __name__ == "__main__":
    main()
