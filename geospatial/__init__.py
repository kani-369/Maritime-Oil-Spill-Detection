"""MambaMPD Geospatial Processing Package."""

from .raster_io import (
    SARRaster,
    load_sentinel1_raster,
    get_maplibre_image_coordinates,
    export_preview_png,
)
from .preprocessor import ExactPreprocessor
from .inference_engine import MambaMPDInferenceEngine, CLASS_NAMES, OIL_SPILL_CLASS_ID
from .vectorizer import vectorize_oil_spill
from .area_calculator import calculate_polygon_area_km2


def run_mambampd_geospatial_pipeline(
    raster_path: str,
    checkpoint_path: str,
    oil_threshold: float = 0.5,
    min_pixel_area: int = 5,
    device: str = None,
):
    """End-to-end geospatial inference and vectorization pipeline.

    1. Loads Sentinel-1 GeoTIFF / SAR raster with CRS and transform.
    2. Loads existing MambaMPD checkpoint without architecture modification.
    3. Preprocesses with exact M4D normalization and reversible divisible-by-32 padding.
    4. Runs forward pass and outputs 5-class prediction.
    5. Extracts Class 1 (oil spill).
    6. Vectorizes oil spill regions into georeferenced polygons.
    7. Computes geodesic / projected surface area in km².
    8. Returns GeoJSON FeatureCollection, preview coordinates, and statistics.
    """
    # Step 1: Load raster
    raster = load_sentinel1_raster(raster_path)

    # Step 2: Initialize engine & load weights
    engine = MambaMPDInferenceEngine(checkpoint_path=checkpoint_path, device=device)

    # Steps 3, 4, 5: Preprocessing, inference, unpadding, extraction
    pred_results = engine.predict(raster.array, oil_threshold=oil_threshold)

    # Steps 6, 7, 8: Vectorization and area calculation
    geojson = vectorize_oil_spill(
        oil_mask=pred_results["oil_spill_mask"],
        oil_prob=pred_results["oil_spill_prob"],
        transform=raster.transform,
        src_crs=raster.crs,
        has_georeference=raster.has_georeference,
        pixel_size=raster.pixel_size,
        min_pixel_area=min_pixel_area,
    )

    # Extract MapLibre coordinates for SAR image layer
    maplibre_coords = None
    if raster.has_georeference and raster.bounds:
        maplibre_coords = get_maplibre_image_coordinates(raster.bounds, raster.crs)

    return {
        "geojson": geojson,
        "metadata": {
            "width": raster.width,
            "height": raster.height,
            "crs": raster.crs,
            "has_georeference": raster.has_georeference,
            "maplibre_coordinates": maplibre_coords,
            "total_oil_spills": geojson["metadata"]["total_oil_spills"],
            "total_area_km2": geojson["metadata"]["total_area_km2"],
        },
        "raster": raster,
        "predictions": pred_results,
    }


__all__ = [
    "SARRaster",
    "load_sentinel1_raster",
    "get_maplibre_image_coordinates",
    "export_preview_png",
    "ExactPreprocessor",
    "MambaMPDInferenceEngine",
    "CLASS_NAMES",
    "OIL_SPILL_CLASS_ID",
    "vectorize_oil_spill",
    "calculate_polygon_area_km2",
    "run_mambampd_geospatial_pipeline",
]

