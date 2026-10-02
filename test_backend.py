"""
Test the full prediction pipeline with a REAL chest X-ray image.
This tests the exact path that fails: gatekeeper passes -> pneumonia prediction -> Grad-CAM
"""
import sys
sys.path.insert(0, r"d:\DiagnoVision")

print("=" * 50)
print("Testing full pipeline with real X-ray")
print("=" * 50)

# Load models
from backend.models import ModelRegistry, run_full_prediction

registry = ModelRegistry()
registry.load_all()

# Read a real chest X-ray image
image_path = r"d:\DiagnoVision\chest_xray\test\PNEUMONIA\person100_bacteria_475.jpeg"
print(f"\nUsing image: {image_path}")

with open(image_path, "rb") as f:
    file_bytes = f.read()
print(f"File size: {len(file_bytes) / 1024:.1f} KB")

# Step 1: Test WITHOUT Grad-CAM
print("\n--- Test 1: Without Grad-CAM ---")
try:
    result = run_full_prediction(registry, file_bytes, include_gradcam=False)
    print(f"Status: {result['status']}")
    print(f"Gatekeeper: {result['gatekeeper']}")
    if result['prediction']:
        print(f"Classification: {result['prediction']['classification']}")
        print(f"Confidence: {result['prediction']['confidence']}%")
    print(f"Processing time: {result['processing_time_ms']}ms")
    print("Test 1 PASSED")
except Exception as e:
    import traceback
    print(f"Test 1 FAILED: {e}")
    traceback.print_exc()

# Step 2: Test WITH Grad-CAM
print("\n--- Test 2: With Grad-CAM ---")
try:
    result = run_full_prediction(registry, file_bytes, include_gradcam=True)
    print(f"Status: {result['status']}")
    if result['prediction']:
        print(f"Classification: {result['prediction']['classification']}")
        print(f"Confidence: {result['prediction']['confidence']}%")
    if result['gradcam']:
        print(f"Grad-CAM available: {result['gradcam']['available']}")
        if result['gradcam']['image_base64']:
            print(f"Grad-CAM base64 length: {len(result['gradcam']['image_base64'])} chars")
    print(f"Processing time: {result['processing_time_ms']}ms")
    print("Test 2 PASSED")
except Exception as e:
    import traceback
    print(f"Test 2 FAILED: {e}")
    traceback.print_exc()

print("\nDone.")
