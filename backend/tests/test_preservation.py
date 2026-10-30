"""
Preservation Property Tests - Non-Buggy Behavior Must Remain Unchanged

Property 2: Preservation - Classification Accuracy, Gatekeeper, API Contract

These tests verify that the bugfix does NOT break existing functionality:
- Classification results must be identical
- Gatekeeper rejection must work correctly
- API response structure must remain unchanged
- Explicit Grad-CAM generation (include_gradcam="true") must continue to work
- /api/gradcam endpoint must remain functional

This test validates Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

IMPORTANT: Run these tests on UNFIXED code FIRST to establish baseline behavior.
"""

import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from hypothesis import given, strategies as st, settings, HealthCheck
import json

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app import app
from backend.models import ModelRegistry
from backend.routes import set_registry


@pytest.fixture(scope="module")
def client():
    """Create a test client with models loaded."""
    registry = ModelRegistry()
    registry.load_all()
    set_registry(registry)
    
    with TestClient(app) as test_client:
        yield test_client


class TestClassificationAccuracyPreservation:
    """Property 2.1: Classification Accuracy Preservation"""
    
    def test_prediction_returns_valid_classification(self, client, sample_image_bytes):
        """
        Verify that predictions return valid classification results.
        
        BASELINE: Establish what constitutes a valid prediction response.
        """
        response = client.post(
            "/api/predict",
            files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")},
            data={"include_gradcam": "false"}  # Disable Grad-CAM to focus on classification
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify prediction structure
        assert "prediction" in data
        assert data["prediction"] is not None
        
        pred = data["prediction"]
        assert "classification" in pred
        assert pred["classification"] in ["NORMAL", "PNEUMONIA"]
        
        assert "confidence" in pred
        assert isinstance(pred["confidence"], (int, float))
        assert 0 <= pred["confidence"] <= 100
        
        assert "probabilities" in pred
        assert "NORMAL" in pred["probabilities"]
        assert "PNEUMONIA" in pred["probabilities"]
        
        # Probabilities should sum to ~100%
        total_prob = pred["probabilities"]["NORMAL"] + pred["probabilities"]["PNEUMONIA"]
        assert 99 <= total_prob <= 101  # Allow for rounding
        
        print(f"[PRESERVATION] Classification: {pred['classification']} ({pred['confidence']}%)")
        print(f"[PRESERVATION] Probabilities: NORMAL={pred['probabilities']['NORMAL']}%, PNEUMONIA={pred['probabilities']['PNEUMONIA']}%")
    
    def test_same_image_produces_consistent_results(self, client, sample_image_bytes):
        """
        Verify that the same image produces consistent classification results.
        
        PRESERVATION: Classification must be deterministic (same input -> same output).
        """
        # Make two requests with the same image
        response1 = client.post(
            "/api/predict",
            files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")},
            data={"include_gradcam": "false"}
        )
        
        response2 = client.post(
            "/api/predict",
            files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")},
            data={"include_gradcam": "false"}
        )
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        pred1 = response1.json()["prediction"]
        pred2 = response2.json()["prediction"]
        
        # Classification should be identical
        assert pred1["classification"] == pred2["classification"]
        
        # Confidence should be very close (allow tiny floating point differences)
        assert abs(pred1["confidence"] - pred2["confidence"]) < 0.1
        
        print(f"[PRESERVATION] Consistent classification: {pred1['classification']}")


class TestGatekeeperFunctionalityPreservation:
    """Property 2.2: Gatekeeper Functionality Preservation"""
    
    def test_gatekeeper_check_runs_on_all_requests(self, client, sample_image_bytes):
        """
        Verify that gatekeeper check runs and returns valid results.
        
        PRESERVATION: Gatekeeper must continue to validate input images.
        """
        response = client.post(
            "/api/predict",
            files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")},
            data={"include_gradcam": "false"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify gatekeeper structure
        assert "gatekeeper" in data
        assert data["gatekeeper"] is not None
        
        gk = data["gatekeeper"]
        assert "result" in gk
        assert gk["result"] in ["passed", "rejected"]
        
        assert "confidence" in gk
        assert isinstance(gk["confidence"], (int, float))
        
        assert "label" in gk
        assert gk["label"] in ["chest_xray", "not_chest_xray"]
        
        print(f"[PRESERVATION] Gatekeeper: {gk['result']} ({gk['confidence']}% - {gk['label']})")
    
    def test_chest_xray_passes_gatekeeper(self, client, sample_normal_image):
        """
        Verify that valid chest X-rays pass the gatekeeper check.
        
        PRESERVATION: Chest X-rays should be accepted by gatekeeper.
        """
        with open(sample_normal_image, "rb") as f:
            image_bytes = f.read()
        
        response = client.post(
            "/api/predict",
            files={"image": ("test.jpg", image_bytes, "image/jpeg")},
            data={"include_gradcam": "false"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Chest X-ray should pass gatekeeper
        assert data["gatekeeper"]["result"] == "passed"
        assert data["gatekeeper"]["label"] == "chest_xray"
        
        # Prediction should be present (not rejected)
        assert data["prediction"] is not None
        
        print(f"[PRESERVATION] Valid chest X-ray passed gatekeeper")


class TestAPIResponseStructurePreservation:
    """Property 2.3: API Response Structure Preservation"""
    
    def test_response_contains_all_required_fields(self, client, sample_image_bytes):
        """
        Verify that API response contains all required fields.
        
        PRESERVATION: API contract must remain unchanged.
        """
        response = client.post(
            "/api/predict",
            files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")},
            data={"include_gradcam": "false"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Top-level fields
        required_fields = ["status", "gatekeeper", "prediction", "gradcam", "model", "processing_time_ms"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Status field
        assert data["status"] in ["success", "rejected", "error"]
        
        # Model field structure
        assert "name" in data["model"]
        assert "input_size" in data["model"]
        assert "checkpoint" in data["model"]
        
        # Processing time
        assert isinstance(data["processing_time_ms"], int)
        assert data["processing_time_ms"] > 0
        
        print(f"[PRESERVATION] API response structure validated - all required fields present")
    
    def test_gradcam_field_structure(self, client, sample_image_bytes):
        """
        Verify that gradcam field has correct structure regardless of availability.
        
        PRESERVATION: gradcam field structure must remain consistent.
        """
        response = client.post(
            "/api/predict",
            files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")},
            data={"include_gradcam": "false"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Gradcam field must always be present
        assert "gradcam" in data
        assert data["gradcam"] is not None
        
        # Required subfields
        assert "available" in data["gradcam"]
        assert "image_base64" in data["gradcam"]
        
        # available is boolean
        assert isinstance(data["gradcam"]["available"], bool)
        
        # If not available, image_base64 should be None
        if not data["gradcam"]["available"]:
            assert data["gradcam"]["image_base64"] is None
        
        print(f"[PRESERVATION] Gradcam field structure correct: available={data['gradcam']['available']}")


class TestExplicitGradCAMGenerationPreservation:
    """Property 2.4: Explicit Grad-CAM Generation Preservation"""
    
    def test_explicit_true_parameter_generates_gradcam(self, client, sample_image_bytes):
        """
        Verify that explicit include_gradcam="true" still generates Grad-CAM server-side.
        
        PRESERVATION: Explicit "true" parameter must continue to work (backward compatibility).
        """
        response = client.post(
            "/api/predict",
            files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")},
            data={"include_gradcam": "true"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Grad-CAM should be available when explicitly requested
        assert data["gradcam"]["available"] is True
        assert data["gradcam"]["image_base64"] is not None
        
        # Verify base64 encoding is valid
        import base64
        try:
            decoded = base64.b64decode(data["gradcam"]["image_base64"])
            assert len(decoded) > 0
            print(f"[PRESERVATION] Explicit 'true' parameter generates valid Grad-CAM ({len(decoded)} bytes)")
        except Exception as e:
            pytest.fail(f"Invalid base64 encoding: {e}")
    
    @given(
        explicit_true=st.sampled_from(["true", "True", "TRUE", "1", "yes", "Yes"])
    )
    @settings(max_examples=3, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_various_true_values_generate_gradcam(self, client, sample_image_bytes, explicit_true):
        """
        Property-based test: Various truthy values should all generate Grad-CAM.
        
        PRESERVATION: Multiple ways to request Grad-CAM must all work.
        """
        response = client.post(
            "/api/predict",
            files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")},
            data={"include_gradcam": explicit_true}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All truthy values should generate Grad-CAM
        assert data["gradcam"]["available"] is True
        assert data["gradcam"]["image_base64"] is not None
        
        print(f"[PROPERTY] Parameter '{explicit_true}' correctly generates Grad-CAM")


class TestDedicatedGradCAMEndpointPreservation:
    """Property 2.5: Dedicated /api/gradcam Endpoint Preservation"""
    
    def test_gradcam_endpoint_generates_heatmap(self, client, sample_image_bytes):
        """
        Verify that /api/gradcam endpoint continues to generate Grad-CAM.
        
        PRESERVATION: Dedicated endpoint must remain functional (unaffected by default parameter changes).
        """
        response = client.post(
            "/api/gradcam",
            files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Dedicated endpoint should always generate Grad-CAM
        assert "available" in data
        assert data["available"] is True
        
        assert "image_base64" in data
        assert data["image_base64"] is not None
        
        # Verify base64 encoding
        import base64
        try:
            decoded = base64.b64decode(data["image_base64"])
            assert len(decoded) > 0
            print(f"[PRESERVATION] /api/gradcam endpoint generates valid heatmap ({len(decoded)} bytes)")
        except Exception as e:
            pytest.fail(f"Invalid base64 encoding: {e}")
    
    def test_gradcam_endpoint_with_target_class(self, client, sample_image_bytes):
        """
        Verify that /api/gradcam endpoint supports target_class parameter.
        
        PRESERVATION: All endpoint parameters must continue to work.
        """
        # Test with target_class=0 (NORMAL)
        response = client.post(
            "/api/gradcam",
            files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")},
            data={"target_class": "0"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["available"] is True
        
        print(f"[PRESERVATION] /api/gradcam with target_class parameter works correctly")


class TestHealthCheckEndpointPreservation:
    """Verify health check endpoint remains functional"""
    
    def test_health_endpoint_returns_status(self, client):
        """
        Verify that /api/health endpoint continues to work correctly.
        
        PRESERVATION: Health check must report model loading status.
        """
        response = client.get("/api/health")
        
        assert response.status_code == 200
        data = response.json()
        
        # Required fields
        assert "status" in data
        assert "models_loaded" in data
        assert "device" in data
        
        # Models should be loaded
        assert data["models_loaded"] is True
        assert data["status"] == "healthy"
        
        # Model details
        assert "models" in data
        assert "pneumonia" in data["models"]
        assert "gatekeeper" in data["models"]
        
        print(f"[PRESERVATION] Health check endpoint works: {data['status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
