"""FastAPI application for MambaMPD Geospatial Marine Oil Spill Detection."""

import os
import shutil
import tempfile
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from fastapi.staticfiles import StaticFiles

from urllib.parse import quote_plus
from PIL import Image
import io

from .schemas import DetectionResponse, HealthResponse, DetectionMetadata
from .services import (
    DetectionService,
    CACHE_DIR,
    CLASS_RGBA,
    find_dataset_images_dir,
    find_model_checkpoint,
)

app = FastAPI(
    title="MambaMPD Geospatial Oil Spill Detection API",
    description="Georeferenced Sentinel-1 SAR Oil Spill Segmentation & Vectorization",
    version="1.0.0",
)

# Enable CORS for React frontend (Vite default :5173, Next default :3000, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = DetectionService()


@app.get("/api/health", response_model=HealthResponse)
def health_check():
    import torch
    default_ckpt = service.default_checkpoint
    ckpt_exists = os.path.isfile(default_ckpt)
    ckpt_size_mb = round(os.path.getsize(default_ckpt) / (1024 * 1024), 2) if ckpt_exists else None
    
    cuda_avail = torch.cuda.is_available()
    dev_name = torch.cuda.get_device_name(0) if cuda_avail else "CPU (Mock/Emulation)"

    dataset_dir = find_dataset_images_dir()
    dataset_count = 0
    if dataset_dir and os.path.isdir(dataset_dir):
        dataset_count = len([f for f in os.listdir(dataset_dir) if f.lower().endswith((".png", ".jpg", ".jpeg", ".tif"))])

    return HealthResponse(
        status="healthy",
        device="cuda" if cuda_avail else "cpu",
        device_name=dev_name,
        cuda_available=cuda_avail,
        pytorch_version=torch.__version__,
        default_checkpoint_path=default_ckpt,
        checkpoint_exists=ckpt_exists,
        checkpoint_size_mb=ckpt_size_mb,
        dataset_dir=dataset_dir,
        dataset_count=dataset_count,
    )


@app.post("/api/detect", response_model=DetectionResponse)
async def detect_oil_spill(
    file: Optional[UploadFile] = File(None),
    file_path: Optional[str] = Form(None),
    checkpoint_path: Optional[str] = Form(None),
    oil_threshold: float = Form(0.5),
    min_pixel_area: int = Form(5),
):
    """Detect oil spill from uploaded Sentinel-1 GeoTIFF or local file path."""
    temp_path = None
    target_path = None
    filename = "input_raster"

    if file is not None and file.filename:
        filename = file.filename
        suffix = os.path.splitext(filename)[1] or ".tif"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=CACHE_DIR) as tmp:
            shutil.copyfileobj(file.file, tmp)
            temp_path = tmp.name
        target_path = temp_path
    elif file_path and os.path.isfile(file_path):
        target_path = file_path
        filename = os.path.basename(file_path)
    else:
        raise HTTPException(
            status_code=400,
            detail="Either upload a file or provide a valid 'file_path' on the server/Kaggle disk.",
        )

    try:
        res = service.process_raster_file(
            file_path=target_path,
            filename=filename,
            checkpoint_path=checkpoint_path,
            oil_threshold=oil_threshold,
            min_pixel_area=min_pixel_area,
        )

        metadata_obj = DetectionMetadata(**res["metadata"])
        return DetectionResponse(
            success=True,
            message="Detection and vectorization completed successfully.",
            metadata=metadata_obj,
            geojson=res["geojson"],
            preview_url=res["preview_url"],
            mask_preview_url=res["mask_preview_url"],
            geojson_download_url=res["geojson_download_url"],
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
    finally:
        if temp_path and os.path.isfile(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.get("/api/preview/{image_id}")
def get_sar_preview(image_id: str):
    path = service.get_cached_file(image_id, "sar.png")
    if not path or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Preview image not found.")
    return FileResponse(path, media_type="image/png")


@app.get("/api/mask/{image_id}")
def get_mask_overlay(image_id: str):
    path = service.get_cached_file(image_id, "mask.png")
    if not path or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Mask overlay not found.")
    return FileResponse(path, media_type="image/png")


@app.get("/api/download/{image_id}")
def download_geojson(image_id: str):
    path = service.get_cached_file(image_id, "geojson")
    if not path or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="GeoJSON not found.")
    return FileResponse(
        path,
        media_type="application/geo+json",
        filename=f"mambampd_oil_spill_{image_id}.geojson",
    )


@app.get("/api/image")
def get_image(path: str = Query(..., description="Absolute path or relative path to image file"),
              thumb: bool = Query(False, description="Whether to downscale to thumbnail"),
              colorize: bool = Query(False, description="Whether this is a 1D mask to colorize")):
    """Safely serve an image or mask from the dataset or cache."""
    clean_path = os.path.abspath(path)
    if not os.path.isfile(clean_path):
        raise HTTPException(status_code=404, detail="Image file not found.")

    try:
        pil_img = Image.open(clean_path)
        if colorize:
            # Colorize 1D index mask (values 0-4) using CLASS_RGBA
            arr = np.array(pil_img)
            h, w = arr.shape[:2]
            rgba = np.zeros((h, w, 4), dtype=np.uint8)
            for cid, col in CLASS_RGBA.items():
                rgba[arr == cid] = col
            pil_img = Image.fromarray(rgba, mode="RGBA")

        if thumb:
            pil_img.thumbnail((128, 128))

        buf = io.BytesIO()
        fmt = "PNG" if (colorize or clean_path.lower().endswith(".png")) else "JPEG"
        pil_img.save(buf, format=fmt, quality=85)
        buf.seek(0)
        if thumb or colorize:
            return Response(content=buf.getvalue(), media_type=f"image/{fmt.lower()}")
        return FileResponse(clean_path)
    except Exception as e:
        # Fallback to direct file response
        return FileResponse(clean_path)


@app.get("/api/samples")
def get_sample_files():
    """List real dataset test images from Kaggle or local repository."""
    dataset_dir = find_dataset_images_dir()
    sample_dirs = [dataset_dir] if dataset_dir else []
    sample_dirs.extend([
        "/kaggle/input/datasets/kanish369/m4d-mambampd-corrected/M4D_MambaMPD_corrected/test/images",
        "/kaggle/input/m4d-mambampd-corrected/M4D_MambaMPD_corrected/test/images",
        "/kaggle/input/m4d-mambampd-corrected/test/images",
        "sample_data",
        "sample_padding_image_for_inference",
    ])

    seen_files = set()
    items = []
    
    for d in sample_dirs:
        if not d or not os.path.isdir(d):
            continue
        try:
            files = sorted(os.listdir(d))
        except Exception:
            continue

        for f in files:
            if not f.lower().endswith((".jpg", ".jpeg", ".png", ".tif", ".tiff")):
                continue
            if f in seen_files:
                continue
            seen_files.add(f)

            full_path = os.path.join(d, f)
            # Check if corresponding 1D ground truth label exists
            label_candidate = full_path.replace("/images/", "/labels_1D/").replace("/images", "/labels_1D")
            has_gt = os.path.isfile(label_candidate)

            # Query dimensions if possible
            dims = "512 × 512"
            try:
                with Image.open(full_path) as im:
                    dims = f"{im.width:,} × {im.height:,}"
            except Exception:
                pass

            item_id = f"item-{len(items) + 1:03d}"
            mtime = os.path.getmtime(full_path)
            dt_str = datetime.date.fromtimestamp(mtime).strftime("%Y %b %d")

            items.append({
                "id": item_id,
                "filename": f,
                "file_path": full_path,
                "date": dt_str,
                "satellite": "Sentinel-1 SAR",
                "resolution": "10 m",
                "dimensions": dims,
                "status": "not_processed",
                "thumbnailUrl": f"/api/image?path={quote_plus(full_path)}&thumb=true",
                "previewUrl": f"/api/image?path={quote_plus(full_path)}",
                "has_ground_truth": has_gt,
                "ground_truth_url": f"/api/image?path={quote_plus(label_candidate)}&colorize=true" if has_gt else None,
            })

            if len(items) >= 40:
                break
        if len(items) >= 40:
            break

    return {"samples": items, "dataset_dir": dataset_dir, "total_found": len(items)}


# Mount React build so FastAPI serves both frontend and backend on one single port
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
