"""
DiagnoVision — Environment Verification Script
Confirms all required libraries are installed and GPU is available.
"""

import sys

print("=" * 60)
print("  DiagnoVision -- Environment Setup Verification")
print("=" * 60)
print()

# Python version
print(f"  Python        : {sys.version.split()[0]}")
print(f"  Python Path   : {sys.executable}")
print()

# --- Core Libraries ---
libraries = {}

try:
    import torch
    libraries["PyTorch"] = torch.__version__
except ImportError:
    libraries["PyTorch"] = "NOT INSTALLED"

try:
    import torchvision
    libraries["TorchVision"] = torchvision.__version__
except ImportError:
    libraries["TorchVision"] = "NOT INSTALLED"

try:
    import numpy
    libraries["NumPy"] = numpy.__version__
except ImportError:
    libraries["NumPy"] = "NOT INSTALLED"

try:
    import pandas
    libraries["Pandas"] = pandas.__version__
except ImportError:
    libraries["Pandas"] = "NOT INSTALLED"

try:
    import matplotlib
    libraries["Matplotlib"] = matplotlib.__version__
except ImportError:
    libraries["Matplotlib"] = "NOT INSTALLED"

try:
    import sklearn
    libraries["Scikit-learn"] = sklearn.__version__
except ImportError:
    libraries["Scikit-learn"] = "NOT INSTALLED"

try:
    import cv2
    libraries["OpenCV"] = cv2.__version__
except ImportError:
    libraries["OpenCV"] = "NOT INSTALLED"

try:
    from PIL import Image
    import PIL
    libraries["Pillow"] = PIL.__version__
except ImportError:
    libraries["Pillow"] = "NOT INSTALLED"

# Print library versions
print("  Library Versions:")
print("  " + "-" * 40)
for lib, ver in libraries.items():
    status = "[OK]" if ver != "NOT INSTALLED" else "[MISSING]"
    print(f"  {status:>9}  {lib:<15} : {ver}")

print()

# --- GPU / CUDA Check ---
print("  GPU / CUDA Status:")
print("  " + "-" * 40)

if "torch" in dir():
    pass

import torch

cuda_available = torch.cuda.is_available()
print(f"  CUDA Available    : {cuda_available}")

if cuda_available:
    print(f"  CUDA Version      : {torch.version.cuda}")
    print(f"  cuDNN Version     : {torch.backends.cudnn.version()}")
    print(f"  GPU Count         : {torch.cuda.device_count()}")
    
    for i in range(torch.cuda.device_count()):
        gpu_name = torch.cuda.get_device_name(i)
        gpu_mem = torch.cuda.get_device_properties(i).total_memory / (1024 ** 3)
        print(f"  GPU {i}             : {gpu_name}")
        print(f"  VRAM              : {gpu_mem:.2f} GB")
    
    # Quick tensor test on GPU
    print()
    print("  GPU Compute Test:")
    print("  " + "-" * 40)
    try:
        x = torch.randn(1000, 1000, device="cuda")
        y = torch.randn(1000, 1000, device="cuda")
        z = torch.mm(x, y)
        torch.cuda.synchronize()
        print(f"  Matrix multiply (1000x1000) on GPU : [PASSED]")
        print(f"  Result tensor device               : {z.device}")
        del x, y, z
        torch.cuda.empty_cache()
    except Exception as e:
        print(f"  GPU compute test FAILED: {e}")
else:
    print("  WARNING: CUDA is NOT available!")
    print("  PyTorch will use CPU only.")

print()

# --- Summary ---
all_installed = all(v != "NOT INSTALLED" for v in libraries.values())
print("=" * 60)
if all_installed and cuda_available:
    print("  [OK] ALL CHECKS PASSED -- Environment is ready!")
    print(f"  [OK] GPU detected: RTX 4050 ready for training")
elif all_installed:
    print("  [WARN] Libraries OK, but CUDA not detected.")
else:
    missing = [k for k, v in libraries.items() if v == "NOT INSTALLED"]
    print(f"  [FAIL] Missing libraries: {', '.join(missing)}")
print("=" * 60)
