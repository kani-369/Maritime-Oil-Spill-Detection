"""Raster I/O and geospatial metadata extraction for Sentinel-1 GeoTIFFs."""

import os
import io
import math
import numpy as np
from PIL import Image
from typing import Dict, Any, Optional, Tuple, List

try:
    import rasterio
    from rasterio.warp import transform_bounds, transform as transform_coords
    from rasterio.transform import Affine
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False

try:
    import tifffile
    HAS_TIFFFILE = True
except ImportError:
    HAS_TIFFFILE = False


class SARRaster:
    """Encapsulates a loaded SAR raster image and its geospatial metadata."""

    def __init__(
        self,
        array: np.ndarray,
        crs: Optional[str],
        transform: Optional[Any],
        bounds: Optional[Tuple[float, float, float, float]],
        pixel_size: Optional[Tuple[float, float]],
        has_georeference: bool,
        metadata: Dict[str, Any],
    ):
        self.array = array  # Shape (C, H, W) or (H, W)
        self.crs = crs
        self.transform = transform
        self.bounds = bounds  # (min_x, min_y, max_x, max_y)
        self.pixel_size = pixel_size
        self.has_georeference = has_georeference
        self.metadata = metadata

    @property
    def height(self) -> int:
        return self.array.shape[-2]

    @property
    def width(self) -> int:
        return self.array.shape[-1]


def load_sentinel1_raster(file_path: str) -> SARRaster:
    """Load a Sentinel-1 GeoTIFF (or image file) and extract geospatial metadata.

    Args:
        file_path: Path to the GeoTIFF, TIFF, JPG, or PNG file.

    Returns:
        SARRaster instance containing normalized array and metadata.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Raster file not found: {file_path}")

    # Method 1: Try rasterio (preferred for full geospatial preservation)
    if HAS_RASTERIO:
        try:
            with rasterio.open(file_path) as src:
                raw_data = src.read()  # (bands, H, W)
                crs_obj = src.crs
                transform = src.transform
                bounds = tuple(src.bounds)
                pixel_size = (abs(src.res[0]), abs(src.res[1]))

                crs_str = crs_obj.to_string() if crs_obj is not None else None
                # Check whether transform is real or trivial default
                has_geo = (
                    crs_str is not None
                    and crs_str.strip() != ""
                    and transform != Affine.identity()
                )

                norm_arr = _prepare_sar_channels(raw_data)
                meta = {
                    "driver": src.driver,
                    "nodata": src.nodata,
                    "count": src.count,
                    "dtype": str(src.dtypes[0]),
                    "crs": crs_str,
                }

                return SARRaster(
                    array=norm_arr,
                    crs=crs_str if has_geo else None,
                    transform=transform if has_geo else None,
                    bounds=bounds if has_geo else None,
                    pixel_size=pixel_size if has_geo else None,
                    has_georeference=has_geo,
                    metadata=meta,
                )
        except Exception:
            pass  # Fallback to secondary readers below

    # Method 2: Try tifffile
    if HAS_TIFFFILE and file_path.lower().endswith((".tif", ".tiff")):
        try:
            with tifffile.TiffFile(file_path) as tif:
                raw_data = tif.asarray()
                if raw_data.ndim == 2:
                    raw_data = raw_data[np.newaxis, ...]
                elif raw_data.ndim == 3 and raw_data.shape[2] in (1, 2, 3, 4):
                    raw_data = np.transpose(raw_data, (2, 0, 1))

                norm_arr = _prepare_sar_channels(raw_data)
                return SARRaster(
                    array=norm_arr,
                    crs=None,
                    transform=None,
                    bounds=None,
                    pixel_size=None,
                    has_georeference=False,
                    metadata={"source": "tifffile"},
                )
        except Exception:
            pass

    # Method 3: Standard PIL Image fallback (e.g. M4D JPG / PNG)
    pil_img = Image.open(file_path)
    np_img = np.array(pil_img)
    if np_img.ndim == 2:
        raw_data = np_img[np.newaxis, ...]
    elif np_img.ndim == 3:
        raw_data = np.transpose(np_img, (2, 0, 1))
    else:
        raise ValueError(f"Unsupported image dimensions: {np_img.shape}")

    norm_arr = _prepare_sar_channels(raw_data)
    return SARRaster(
        array=norm_arr,
        crs=None,
        transform=None,
        bounds=None,
        pixel_size=None,
        has_georeference=False,
        metadata={"source": "PIL"},
    )


def _prepare_sar_channels(raw_data: np.ndarray) -> np.ndarray:
    """Normalize raw SAR data into 3-channel 8-bit equivalent array (3, H, W).

    Matches the M4D input domain (3-channel SAR intensity, 0-255).
    """
    if raw_data.ndim == 2:
        raw_data = raw_data[np.newaxis, ...]

    c, h, w = raw_data.shape

    # Normalize floating-point or 16-bit SAR intensity to [0, 255] uint8 representation
    scaled_bands = []
    for band_idx in range(min(c, 3)):
        band = raw_data[band_idx].astype(np.float32)
        # Replace non-finite values (NaN / Inf) with min
        finite_mask = np.isfinite(band)
        if not np.any(finite_mask):
            scaled_bands.append(np.zeros((h, w), dtype=np.float32))
            continue

        valid_vals = band[finite_mask]
        b_min = np.percentile(valid_vals, 1)
        b_max = np.percentile(valid_vals, 99)
        if b_max > b_min:
            norm_band = np.clip((band - b_min) / (b_max - b_min) * 255.0, 0.0, 255.0)
        else:
            norm_band = np.zeros((h, w), dtype=np.float32)
        scaled_bands.append(norm_band)

    # Replicate or compose to exactly 3 channels
    if len(scaled_bands) == 1:
        # Single band (e.g. VV amplitude/intensity): replicate 3 times
        stacked = np.stack([scaled_bands[0], scaled_bands[0], scaled_bands[0]], axis=0)
    elif len(scaled_bands) == 2:
        # Dual-pol (VV, VH): create ratio as 3rd channel
        ratio = np.clip(scaled_bands[0] - scaled_bands[1] + 128.0, 0.0, 255.0)
        stacked = np.stack([scaled_bands[0], scaled_bands[1], ratio], axis=0)
    else:
        stacked = np.stack(scaled_bands[:3], axis=0)

    return stacked


def get_maplibre_image_coordinates(
    bounds: Tuple[float, float, float, float],
    src_crs: str,
) -> Optional[List[List[float]]]:
    """Convert raster bounding box to MapLibre GL JS image quad coordinates:

    [ [top_left_lon, top_left_lat],
      [top_right_lon, top_right_lat],
      [bottom_right_lon, bottom_right_lat],
      [bottom_left_lon, bottom_left_lat] ]

    Strictly converts to WGS84 (EPSG:4326) without inventing fake coordinates.
    """
    if not bounds or not src_crs:
        return None

    min_x, min_y, max_x, max_y = bounds

    if HAS_RASTERIO:
        try:
            # Transform bounds directly into WGS84 (EPSG:4326)
            wgs84_bounds = transform_bounds(src_crs, "EPSG:4326", min_x, min_y, max_x, max_y)
            w_min_lon, w_min_lat, w_max_lon, w_max_lat = wgs84_bounds
            # MapLibre requires: [top-left, top-right, bottom-right, bottom-left]
            return [
                [w_min_lon, w_max_lat],  # top-left
                [w_max_lon, w_max_lat],  # top-right
                [w_max_lon, w_min_lat],  # bottom-right
                [w_min_lon, w_min_lat],  # bottom-left
            ]
        except Exception:
            pass

    # If already EPSG:4326
    if "4326" in str(src_crs).upper():
        return [
            [min_x, max_y],  # top-left
            [max_x, max_y],  # top-right
            [max_x, min_y],  # bottom-right
            [min_x, min_y],  # bottom-left
        ]

    return None


def export_preview_png(array_3ch: np.ndarray) -> bytes:
    """Generate an optimized PNG thumbnail/overlay from (3, H, W) array."""
    # Transpose to (H, W, 3)
    rgb = np.transpose(array_3ch, (1, 2, 0)).astype(np.uint8)
    img = Image.fromarray(rgb)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

