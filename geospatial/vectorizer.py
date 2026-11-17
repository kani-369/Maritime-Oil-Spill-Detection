"""Vectorization of oil spill masks into georeferenced polygons and GeoJSON export."""

import os
import json
import cv2
import numpy as np
from typing import Dict, Any, List, Optional, Tuple

try:
    import rasterio
    import rasterio.features
    from rasterio.warp import transform_geom
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False

try:
    from shapely.geometry import shape, mapping, Polygon, MultiPolygon
    from shapely.ops import transform as shapely_transform
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False

from .area_calculator import calculate_polygon_area_km2


def vectorize_oil_spill(
    oil_mask: np.ndarray,
    oil_prob: Optional[np.ndarray],
    transform: Optional[Any],
    src_crs: Optional[str],
    has_georeference: bool,
    pixel_size: Optional[Tuple[float, float]] = None,
    min_pixel_area: int = 5,
) -> Dict[str, Any]:
    """Convert a binary oil spill mask into georeferenced GeoJSON polygons with area in km².

    Args:
        oil_mask: (H, W) uint8 binary mask (1 for oil spill, 0 for background).
        oil_prob: Optional (H, W) float32 probability map for confidence calculation.
        transform: Affine transform (rasterio.Affine or 6-tuple: c, a, b, f, d, e).
        src_crs: Source Coordinate Reference System string (e.g. 'EPSG:4326', 'EPSG:32632').
        has_georeference: Boolean indicating whether valid geospatial metadata exists.
        pixel_size: (res_x_m, res_y_m) in meters.
        min_pixel_area: Minimum connected pixel count to filter out solitary speckle noise.

    Returns:
        GeoJSON FeatureCollection dict conforming to RFC 7946.
    """
    assert oil_mask.ndim == 2, f"Expected 2D binary mask, got {oil_mask.shape}"
    h, w = oil_mask.shape

    features = []
    total_area_km2 = 0.0

    # Ensure mask is clean uint8
    binary = (oil_mask > 0).astype(np.uint8)

    # Method 1: Rasterio feature extraction (when available and georeferenced)
    if HAS_RASTERIO and HAS_SHAPELY and has_georeference and transform is not None:
        try:
            # rasterio.features.shapes yields (geojson_dict, value)
            shapes_gen = rasterio.features.shapes(binary, mask=(binary == 1), transform=transform)
            feature_idx = 1
            for geom_dict, val in shapes_gen:
                if val != 1:
                    continue

                poly_geom = shape(geom_dict)
                # Filter small noise
                if poly_geom.is_empty:
                    continue

                # Reproject geometry to WGS84 (EPSG:4326) if source CRS is projected
                wgs84_geom_dict = geom_dict
                if src_crs and "4326" not in str(src_crs).upper():
                    try:
                        wgs84_geom_dict = transform_geom(src_crs, "EPSG:4326", geom_dict)
                        wgs84_poly = shape(wgs84_geom_dict)
                    except Exception:
                        wgs84_poly = poly_geom
                else:
                    wgs84_poly = poly_geom

                # Calculate true surface area in km² using geodesic/projected CRS
                area_km2 = calculate_polygon_area_km2(wgs84_poly, crs="EPSG:4326")
                if area_km2 <= 0.0:
                    continue

                # Compute mean confidence inside this polygon
                mean_conf = _compute_polygon_confidence(wgs84_poly, oil_prob, transform, (h, w))

                centroid = [float(wgs84_poly.centroid.x), float(wgs84_poly.centroid.y)]
                bbox = [float(b) for b in wgs84_poly.bounds]  # [minx, miny, maxx, maxy]

                feat = {
                    "type": "Feature",
                    "id": feature_idx,
                    "properties": {
                        "spill_id": feature_idx,
                        "class_id": 1,
                        "class_name": "oil_spill",
                        "area_km2": round(area_km2, 4),
                        "mean_confidence": round(float(mean_conf), 4),
                        "centroid": centroid,
                        "bounds": bbox,
                        "is_georeferenced": True,
                        "src_crs": src_crs,
                    },
                    "geometry": wgs84_geom_dict,
                }
                features.append(feat)
                total_area_km2 += area_km2
                feature_idx += 1

            if len(features) > 0:
                return _build_feature_collection(features, total_area_km2, src_crs, has_georeference)
        except Exception as e:
            print(f"[vectorize_oil_spill] Rasterio vectorization fallback triggered: {e}")

    # Method 2: OpenCV contour vectorization with manual affine mapping
    # Works in all environments (including pure pixel coordinates when not georeferenced)
    contours, hierarchy = cv2.findContours(binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    feature_idx = 1

    if contours:
        for idx, cnt in enumerate(contours):
            # Check if this is an external contour
            is_external = (hierarchy[0][idx][3] == -1) if hierarchy is not None else True
            if not is_external:
                continue

            px_area = cv2.contourArea(cnt)
            if px_area < min_pixel_area:
                continue

            # Convert contour points to coordinates
            coords_ring = []
            for pt in cnt[:, 0, :]:
                col, row = float(pt[0]), float(pt[1])
                if has_georeference and transform is not None:
                    # Apply affine transform: x = c + a*col + b*row, y = f + d*col + e*row
                    c, a, b, f, d, e = _unpack_transform(transform)
                    geo_x = c + a * col + b * row
                    geo_y = f + d * col + e * row
                    coords_ring.append([round(geo_x, 7), round(geo_y, 7)])
                else:
                    # Pure pixel coordinate (Strict constraint 6: do not invent fake lat/lon)
                    coords_ring.append([round(col, 2), round(row, 2)])

            if len(coords_ring) < 3:
                continue

            # Close the ring
            if coords_ring[0] != coords_ring[-1]:
                coords_ring.append(coords_ring[0])

            geom = {
                "type": "Polygon",
                "coordinates": [coords_ring],
            }

            # Area calculation
            if has_georeference:
                area_km2 = calculate_polygon_area_km2(geom, crs=src_crs, pixel_resolution_m=pixel_size)
            else:
                # Pixel area scaled by resolution in meters (e.g., 10m x 10m Sentinel-1 pixel)
                res_m = pixel_size if pixel_size is not None else (10.0, 10.0)
                area_km2 = (px_area * res_m[0] * res_m[1]) / 1_000_000.0

            # Centroid & Bounding Box
            xs = [p[0] for p in coords_ring]
            ys = [p[1] for p in coords_ring]
            centroid = [round(float(np.mean(xs)), 6), round(float(np.mean(ys)), 6)]
            bbox = [min(xs), min(ys), max(xs), max(ys)]

            # Confidence
            conf = 0.90
            if oil_prob is not None:
                mask_contour = np.zeros((h, w), dtype=np.uint8)
                cv2.drawContours(mask_contour, [cnt], -1, 1, thickness=-1)
                spill_px_vals = oil_prob[mask_contour == 1]
                if len(spill_px_vals) > 0:
                    conf = float(np.mean(spill_px_vals))

            feat = {
                "type": "Feature",
                "id": feature_idx,
                "properties": {
                    "spill_id": feature_idx,
                    "class_id": 1,
                    "class_name": "oil_spill",
                    "area_km2": round(float(area_km2), 4),
                    "mean_confidence": round(float(conf), 4),
                    "centroid": centroid,
                    "bounds": bbox,
                    "is_georeferenced": has_georeference,
                    "src_crs": src_crs,
                },
                "geometry": geom,
            }
            features.append(feat)
            total_area_km2 += area_km2
            feature_idx += 1

    return _build_feature_collection(features, total_area_km2, src_crs, has_georeference)


def _unpack_transform(transform: Any) -> Tuple[float, float, float, float, float, float]:
    """Extract (c, a, b, f, d, e) coefficients from Affine object or tuple."""
    if hasattr(transform, "c"):
        return transform.c, transform.a, transform.b, transform.f, transform.d, transform.e
    elif hasattr(transform, "to_gdal"):
        g = transform.to_gdal()
        return g[0], g[1], g[2], g[3], g[4], g[5]
    elif isinstance(transform, (list, tuple)) and len(transform) >= 6:
        return transform[0], transform[1], transform[2], transform[3], transform[4], transform[5]
    return 0.0, 1.0, 0.0, 0.0, 0.0, 1.0


def _compute_polygon_confidence(poly: Any, prob_map: Optional[np.ndarray], transform: Any, shape: Tuple[int, int]) -> float:
    """Compute mean oil spill confidence for pixels covered by the polygon."""
    if prob_map is None:
        return 0.85
    try:
        if HAS_RASTERIO:
            poly_mask = rasterio.features.geometry_mask([poly], out_shape=shape, transform=transform, invert=True)
            vals = prob_map[poly_mask]
            if len(vals) > 0:
                return float(np.mean(vals))
    except Exception:
        pass
    return 0.85


def _build_feature_collection(
    features: List[Dict[str, Any]],
    total_area_km2: float,
    src_crs: Optional[str],
    has_georeference: bool,
) -> Dict[str, Any]:
    """Assemble final standard GeoJSON FeatureCollection."""
    return {
        "type": "FeatureCollection",
        "metadata": {
            "total_oil_spills": len(features),
            "total_area_km2": round(float(total_area_km2), 4),
            "crs": src_crs if has_georeference else None,
            "has_georeference": has_georeference,
            "generator": "MambaMPD Geospatial Vectorizer",
        },
        "features": features,
    }

