"""Kaggle Turnkey Execution Script for MambaMPD Geospatial Pipeline.

Designed specifically for running inside Kaggle Notebooks:
1. Auto-detects Kaggle dataset paths and checkpoints.
2. Runs batch or single-image inference on Sentinel-1 GeoTIFFs or M4D test images.
3. Vectorizes Class 1 (oil spill) into georeferenced polygons.
4. Computes geodesic area in km².
5. Exports RFC 7946 GeoJSON files and a comprehensive CSV analytics summary.
"""

import os
import sys
import glob
import json
import csv
import argparse
from tqdm import tqdm

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

# Ensure parent directory is in python path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from geospatial import (
    load_sentinel1_raster,
    vectorize_oil_spill,
    export_preview_png,
    MambaMPDInferenceEngine,
)


def find_default_kaggle_paths():
    """Look for common Kaggle dataset and checkpoint locations."""
    checkpoint_candidates = [
        "/kaggle/input/**/final_model.pth",
        "/kaggle/input/**/mambampd_best.pt",
        "/kaggle/input/**/*.pth",
        "/kaggle/input/**/*.pt",
        "/kaggle/working/**/final_model.pth",
        "/kaggle/working/**/mambampd_best.pt",
        "mambampd/mambampd_best.pt",
        "mambampd_best.pt",
    ]
    ckpt = None
    for pattern in checkpoint_candidates:
        matches = glob.glob(pattern, recursive=True)
        if matches:
            ckpt = matches[0]
            break

    input_candidates = [
        "/kaggle/input/**/test/images",
        "/kaggle/input/**/test",
        "/kaggle/input/**/images",
        "data/M4D/test/images",
        "sample_padding_image_for_inference",
    ]
    inp = None
    for pattern in input_candidates:
        matches = glob.glob(pattern, recursive=True)
        if matches and os.path.isdir(matches[0]):
            inp = matches[0]
            break

    return ckpt, inp


def run_kaggle_pipeline(
    input_path: str,
    checkpoint_path: str,
    output_dir: str = "/kaggle/working/detections",
    oil_threshold: float = 0.5,
    min_pixel_area: int = 5,
    max_images: int = 0,
):
    os.makedirs(output_dir, exist_ok=True)
    geojson_dir = os.path.join(output_dir, "geojson")
    preview_dir = os.path.join(output_dir, "previews")
    os.makedirs(geojson_dir, exist_ok=True)
    os.makedirs(preview_dir, exist_ok=True)

    print("=" * 70)
    print("🌊 MambaMPD Kaggle Geospatial Oil Spill Pipeline")
    print("=" * 70)
    print(f"Input Path:       {input_path}")
    print(f"Model Checkpoint: {checkpoint_path}")
    print(f"Output Directory: {output_dir}")

    # Initialize MambaMPD inference engine
    engine = MambaMPDInferenceEngine(checkpoint_path=checkpoint_path)

    # Collect images
    if os.path.isfile(input_path):
        image_files = [input_path]
    elif os.path.isdir(input_path):
        exts = ("*.tif", "*.tiff", "*.jpg", "*.jpeg", "*.png")
        image_files = []
        for ext in exts:
            image_files.extend(glob.glob(os.path.join(input_path, ext)))
            image_files.extend(glob.glob(os.path.join(input_path, "**", ext), recursive=True))
        image_files = sorted(list(set(image_files)))
    else:
        raise FileNotFoundError(f"Input path does not exist: {input_path}")

    if not image_files:
        print(f"No SAR or GeoTIFF images found in {input_path}")
        return

    if max_images > 0:
        image_files = image_files[:max_images]

    print(f"Found {len(image_files)} images to process.\n")

    summary_records = []

    for file_path in tqdm(image_files, desc="Processing SAR rasters"):
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        try:
            # 1. Load raster with geospatial metadata
            raster = load_sentinel1_raster(file_path)

            # 2. Run MambaMPD inference
            pred_results = engine.predict(raster.array, oil_threshold=oil_threshold)

            # 3. Vectorize Class 1 (oil spill) and calculate area in km²
            geojson = vectorize_oil_spill(
                oil_mask=pred_results["oil_spill_mask"],
                oil_prob=pred_results["oil_spill_prob"],
                transform=raster.transform,
                src_crs=raster.crs,
                has_georeference=raster.has_georeference,
                pixel_size=raster.pixel_size,
                min_pixel_area=min_pixel_area,
            )

            # 4. Save GeoJSON
            geojson_out_path = os.path.join(geojson_dir, f"{base_name}_oil_spill.geojson")
            with open(geojson_out_path, "w", encoding="utf-8") as f:
                json.dump(geojson, f, indent=2)

            # 5. Save visual preview PNG
            preview_bytes = export_preview_png(raster.array)
            preview_out_path = os.path.join(preview_dir, f"{base_name}_preview.png")
            with open(preview_out_path, "wb") as f:
                f.write(preview_bytes)

            # Record stats
            meta = geojson["metadata"]
            spill_areas = [f["properties"]["area_km2"] for f in geojson.get("features", [])]
            largest_area = max(spill_areas) if spill_areas else 0.0

            summary_records.append({
                "image_name": os.path.basename(file_path),
                "width": raster.width,
                "height": raster.height,
                "crs": raster.crs or "None (Pixel Space)",
                "has_georeference": raster.has_georeference,
                "total_spills_detected": meta["total_oil_spills"],
                "total_area_km2": meta["total_area_km2"],
                "largest_spill_km2": round(float(largest_area), 4),
                "geojson_path": geojson_out_path,
            })
        except Exception as e:
            print(f"Error processing {file_path}: {e}")

    # Export summary CSV
    summary_csv_path = os.path.join(output_dir, "oil_spill_summary.csv")
    if HAS_PANDAS:
        df = pd.DataFrame(summary_records)
        df.to_csv(summary_csv_path, index=False)
    else:
        if summary_records:
            fieldnames = list(summary_records[0].keys())
            with open(summary_csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(summary_records)

    print("\n" + "=" * 70)
    print("✅ Pipeline Completed Successfully!")
    print(f"Total Images Processed:       {len(summary_records)}")
    total_spills = sum(r["total_spills_detected"] for r in summary_records)
    total_area = sum(r["total_area_km2"] for r in summary_records)
    print(f"Total Oil Spill Polygons:     {total_spills}")
    print(f"Total Oil Spill Area:         {total_area:.4f} km²")
    print(f"Summary Table Saved To:       {summary_csv_path}")
    print(f"GeoJSON Files Saved To:       {geojson_dir}")
    print("=" * 70)


def main():
    default_ckpt, default_inp = find_default_kaggle_paths()

    parser = argparse.ArgumentParser(description="MambaMPD Kaggle Geospatial Runner")
    parser.add_argument("--input_path", type=str, default=default_inp, help="Directory of GeoTIFFs or single image")
    parser.add_argument("--checkpoint", type=str, default=default_ckpt, help="MambaMPD checkpoint path")
    parser.add_argument("--output_dir", type=str, default="/kaggle/working/detections", help="Output directory")
    parser.add_argument("--oil_threshold", type=float, default=0.5, help="Confidence threshold for oil spill")
    parser.add_argument("--min_pixel_area", type=int, default=5, help="Min connected pixel count filter")
    parser.add_argument("--max_images", type=int, default=0, help="Max images to process (0 = all)")
    args = parser.parse_args()

    if not args.input_path:
        print("[ERROR] No input images specified. Please provide --input_path.")
        sys.exit(1)

    run_kaggle_pipeline(
        input_path=args.input_path,
        checkpoint_path=args.checkpoint,
        output_dir=args.output_dir,
        oil_threshold=args.oil_threshold,
        min_pixel_area=args.min_pixel_area,
        max_images=args.max_images,
    )


if __name__ == "__main__":
    main()
