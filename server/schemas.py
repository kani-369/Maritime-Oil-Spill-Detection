"""Pydantic schemas for the MambaMPD Geospatial API."""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel


class DetectionMetadata(BaseModel):
    image_id: str
    filename: str
    width: int
    height: int
    crs: Optional[str] = None
    has_georeference: bool
    maplibre_coordinates: Optional[List[List[float]]] = None
    total_oil_spills: int
    total_area_km2: float
    largest_spill_km2: float
    detection_id: Optional[str] = None
    sheen_area_km2: Optional[float] = None
    thick_area_km2: Optional[float] = None
    perimeter_km: Optional[float] = None
    centroid_lat_lon: Optional[str] = None
    distance_to_shore_km: Optional[float] = None
    model_confidence: Optional[float] = None
    acquisition_date: Optional[str] = None
    satellite: Optional[str] = None
    polarization: Optional[str] = None
    resolution: Optional[str] = None
    latency_ms: Optional[float] = None
    device: Optional[str] = None
    checkpoint_loaded: Optional[str] = None


class DetectionResponse(BaseModel):
    success: bool
    message: str
    metadata: DetectionMetadata
    geojson: Dict[str, Any]
    preview_url: str
    mask_preview_url: str
    geojson_download_url: str


class HealthResponse(BaseModel):
    status: str
    device: str
    device_name: Optional[str] = None
    cuda_available: bool
    pytorch_version: str
    default_checkpoint_path: str
    checkpoint_exists: bool
    checkpoint_size_mb: Optional[float] = None
    dataset_dir: Optional[str] = None
    dataset_count: Optional[int] = None
