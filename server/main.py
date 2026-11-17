"""FastAPI application for MambaMPD Geospatial Marine Oil Spill Detection."""

import os
import shutil
import tempfile
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .schemas import DetectionResponse, HealthResponse, DetectionMetadata
from .services import DetectionService, CACHE_DIR

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
    return HealthResponse(
        status="healthy",
        device="cuda" if torch.cuda.is_available() else "cpu",
        cuda_available=torch.cuda.is_available(),
        pytorch_version=torch.__version__,
        default_checkpoint_path=default_ckpt,
        checkpoint_exists=os.path.isfile(default_ckpt),
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


@app.get("/api/samples")
def get_sample_files():
    """List available sample images in the repository or common dataset locations."""
    sample_dirs = [
        "sample_data",
        "sample_padding_image_for_inference",
        "data/M4D/test/images",
        "/kaggle/input/m4d-oil-spill-detection-dataset/test/images",
    ]
    found = []
    for d in sample_dirs:
        if os.path.isdir(d):
            for f in os.listdir(d):
                if f.lower().endswith((".jpg", ".jpeg", ".png", ".tif", ".tiff")):
                    found.append({"name": f, "path": os.path.join(d, f)})
    return {"samples": found[:15]}
