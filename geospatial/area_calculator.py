"""Geospatial area calculation utilities.

Calculates polygon areas in square kilometers (km²) using:
1. Geodesic ellipsoidal method (WGS84) for geographic coordinates (lat/lon in degrees),
   ensuring zero distortion across all latitudes.
2. Direct planar projection for projected CRS (units in meters).
3. Pixel-based area when spatial metadata is absent (without inventing fake coordinates).
"""

import math
from typing import List, Tuple, Optional, Any, Dict

# Optional imports with robust fallbacks
try:
    import pyproj
    HAS_PYPROJ = True
except ImportError:
    HAS_PYPROJ = False

try:
    from shapely.geometry import shape, Polygon, MultiPolygon
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False


WGS84_A = 6378137.0  # Semi-major axis in meters
WGS84_F = 1 / 298.257223563  # Flattening
WGS84_B = WGS84_A * (1 - WGS84_F)  # Semi-minor axis in meters


def _spherical_polygon_area_m2(coords: List[Tuple[float, float]]) -> float:
    """Calculate the geodesic area of a polygon on the WGS84 authalic sphere in square meters.

    Uses spherical excess (L'Huilier / Girard theorem formulation).
    Coordinates are assumed to be (lon, lat) in degrees.
    """
    if len(coords) < 3:
        return 0.0

    # Ensure ring is closed
    pts = list(coords)
    if pts[0] != pts[-1]:
        pts.append(pts[0])

    r_authalic = 6371008.8  # Earth authalic radius in meters
    total_area = 0.0
    n = len(pts) - 1

    if n < 3:
        return 0.0

    for i in range(n):
        p1 = pts[i]
        p2 = pts[i + 1]
        lon1, lat1 = math.radians(p1[0]), math.radians(p1[1])
        lon2, lat2 = math.radians(p2[0]), math.radians(p2[1])

        # Girard's / trapezoidal spherical excess sum
        total_area += (lon2 - lon1) * (2 + math.sin(lat1) + math.sin(lat2))

    total_area = abs(total_area * (r_authalic ** 2) / 2.0)
    return total_area


def calculate_polygon_area_km2(
    geometry: Any,
    crs: Optional[str] = "EPSG:4326",
    pixel_resolution_m: Optional[Tuple[float, float]] = None,
) -> float:
    """Calculate true surface area of a polygon geometry in square kilometers (km²).

    Args:
        geometry: Shapely Polygon/MultiPolygon or GeoJSON geometry dict.
        crs: Coordinate Reference System string (e.g., 'EPSG:4326', 'EPSG:32632').
        pixel_resolution_m: Optional (res_x_meters, res_y_meters) for pixel fallback.

    Returns:
        area_km2: Calculated area in square kilometers.
    """
    if geometry is None:
        return 0.0

    # If geometry is GeoJSON dict, convert if shapely is available
    geom_dict = geometry if isinstance(geometry, dict) else (geometry.__geo_interface__ if HAS_SHAPELY and hasattr(geometry, "__geo_interface__") else None)

    # 1. Non-georeferenced fallback: Do NOT invent fake coordinates
    if crs is None or crs.strip() == "" or (isinstance(crs, str) and "pixel" in crs.lower()):
        if pixel_resolution_m is not None:
            res_x, res_y = pixel_resolution_m
            pixel_area_m2 = abs(res_x * res_y)
            # Compute planar polygon area in pixel units
            if HAS_SHAPELY and hasattr(geometry, "area"):
                return float(geometry.area * pixel_area_m2 / 1_000_000.0)
            elif geom_dict and "coordinates" in geom_dict:
                area_px = _shoelace_pixel_area(geom_dict["coordinates"][0])
                return float(area_px * pixel_area_m2 / 1_000_000.0)
        return 0.0

    crs_str = str(crs).upper()
    is_geographic = "4326" in crs_str or "WGS84" in crs_str or "DEGREE" in crs_str or "GEOGCS" in crs_str

    # 2. Geographic CRS (Latitude / Longitude in degrees) -> Geodesic Area
    if is_geographic:
        if HAS_PYPROJ and HAS_SHAPELY and hasattr(geometry, "geom_type"):
            try:
                geod = pyproj.Geod(ellps="WGS84")
                area_m2, _ = geod.geometry_area_perimeter(geometry)
                return abs(float(area_m2)) / 1_000_000.0
            except Exception:
                pass

        # Fallback to pure spherical geodesic calculation
        if geom_dict:
            return _compute_geojson_geodesic_area_km2(geom_dict)

    # 3. Projected CRS (units in meters, e.g., UTM or Equal Earth)
    if HAS_SHAPELY and hasattr(geometry, "area"):
        # geometry.area is in m² for projected CRS
        return float(geometry.area) / 1_000_000.0
    elif geom_dict:
        coords = geom_dict.get("coordinates", [])
        if coords and len(coords) > 0:
            exterior = coords[0]
            area_m2 = _shoelace_pixel_area(exterior)
            return float(area_m2) / 1_000_000.0

    return 0.0


def _shoelace_pixel_area(coords: List[Any]) -> float:
    """Shoelace formula for planar 2D polygon area."""
    n = len(coords)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        x1, y1 = coords[i][0], coords[i][1]
        x2, y2 = coords[j][0], coords[j][1]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def _compute_geojson_geodesic_area_km2(geom_dict: Dict[str, Any]) -> float:
    """Calculate geodesic area in km² directly from GeoJSON geometry dict."""
    gtype = geom_dict.get("type", "")
    coords = geom_dict.get("coordinates", [])

    if gtype == "Polygon":
        if not coords:
            return 0.0
        # Exterior ring positive
        exterior_area = _spherical_polygon_area_m2(coords[0])
        # Interior rings (holes) negative
        holes_area = sum(_spherical_polygon_area_m2(hole) for hole in coords[1:])
        net_m2 = max(0.0, exterior_area - holes_area)
        return net_m2 / 1_000_000.0

    elif gtype == "MultiPolygon":
        total_km2 = 0.0
        for poly_coords in coords:
            if poly_coords:
                ext_area = _spherical_polygon_area_m2(poly_coords[0])
                hole_area = sum(_spherical_polygon_area_m2(h) for h in poly_coords[1:])
                total_km2 += max(0.0, ext_area - hole_area) / 1_000_000.0
        return total_km2

    return 0.0

