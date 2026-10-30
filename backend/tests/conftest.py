"""
Pytest Configuration and Fixtures for DiagnoVision Backend Tests
"""

import pytest
from pathlib import Path
from PIL import Image
import io


@pytest.fixture(scope="session")
def project_root():
    """Return the project root directory."""
    return Path(__file__).resolve().parent.parent.parent


@pytest.fixture(scope="session")
def test_images_dir(project_root):
    """Return the test images directory."""
    return project_root / "chest_xray" / "test"


@pytest.fixture
def sample_normal_image(test_images_dir):
    """Load a sample NORMAL chest X-ray image."""
    normal_dir = test_images_dir / "NORMAL"
    if not normal_dir.exists():
        pytest.skip("Test images not available")
    
    # Get first available image
    images = list(normal_dir.glob("*.jpeg"))
    if not images:
        pytest.skip("No NORMAL test images found")
    
    return images[0]


@pytest.fixture
def sample_pneumonia_image(test_images_dir):
    """Load a sample PNEUMONIA chest X-ray image."""
    pneumonia_dir = test_images_dir / "PNEUMONIA"
    if not pneumonia_dir.exists():
        pytest.skip("Test images not available")
    
    # Get first available image
    images = list(pneumonia_dir.glob("*.jpeg"))
    if not images:
        pytest.skip("No PNEUMONIA test images found")
    
    return images[0]


@pytest.fixture
def sample_image_bytes(sample_normal_image):
    """Return image as bytes for API testing."""
    with open(sample_normal_image, "rb") as f:
        return f.read()


@pytest.fixture
def create_test_image_bytes():
    """Factory fixture to create test image bytes."""
    def _create(width=224, height=224, mode="RGB"):
        img = Image.new(mode, (width, height), color="gray")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        return buf.read()
    return _create
