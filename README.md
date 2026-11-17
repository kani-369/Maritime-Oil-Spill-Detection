# Maritime Oil Spill Detection using MambaMPD & Geospatial Analytics

A deep-learning segmentation framework tailored for fine-grained marine oil-spill detection and classification from Synthetic Aperture Radar (SAR) remote sensing imagery, powered by Visual State Space Models (Mamba).

Now includes an **end-to-end Geospatial Processing Pipeline, FastAPI Backend, and React + MapLibre GL JS Interactive Map** to extract georeferenced oil spill polygons, calculate true surface area in km², and export RFC 7946 GeoJSON.

---

## Key Features

1. **Model & Architecture Preservation**:
   * Reuses your trained **MambaMPD** model (`mambampd_best.pt`) directly without altering architecture or weights.
   * Full 5-class semantic segmentation: `sea_surface` (0), `oil_spill` (1), `look_alike` (2), `ship` (3), `land` (4).
2. **Exact Training Preprocessing**:
   * Exact M4D normalization: `(image / 255.0 - 0.5185) / 0.197`.
   * Reversible divisible-by-32 reflection padding with exact cropping to guarantee 1-to-1 pixel geometric alignment.
3. **Geospatial Processing**:
   * Reads Sentinel-1 GeoTIFF rasters using `rasterio`, preserving affine transforms and CRS.
   * Vectorizes Class 1 (oil spill) regions into georeferenced polygons with `rasterio.features.shapes` and OpenCV.
   * Calculates surface area in **km²** using **geodesic ellipsoidal integration (WGS84)** for geographic coordinates and projected planar metrics for UTM/Equal-Area projections.
   * **Strict Metadata Rule**: Does not invent fake coordinates when spatial metadata is absent; seamlessly operates in pixel coordinate mode.
4. **Full-Stack Application**:
   * **Backend**: Python + FastAPI (`server/main.py`) with REST endpoints for file uploads, direct Kaggle/disk file processing, GeoJSON export, and raster preview generation.
   * **Frontend**: React + Tailwind CSS + MapLibre GL JS (`frontend/`) with dark/satellite basemaps, SAR image overlay, glowing polygon fills, and interactive click inspection.
   * **Kaggle Turnkey Runner**: Dedicated batch runner (`kaggle/run_pipeline_kaggle.py`) and notebook (`kaggle/mambampd_geospatial_demo.ipynb`).

---

## Directory Layout

```text
MambaMPD/
├── geospatial/                     # Core Geospatial & Inference Engine
│   ├── __init__.py                 # High-level pipeline API
│   ├── raster_io.py                # GeoTIFF loading, CRS & bounds extraction
│   ├── preprocessor.py             # Exact training normalization & reversible padding
│   ├── inference_engine.py         # MambaMPD checkpoint runner
│   ├── vectorizer.py               # Vectorization to GeoJSON polygons
│   └── area_calculator.py          # Geodesic area calculation in km²
├── server/                         # FastAPI Backend
│   ├── main.py                     # REST endpoints (/api/detect, /api/preview, etc.)
│   ├── schemas.py                  # Pydantic request/response models
│   └── services.py                 # Pipeline execution & artifact caching
├── frontend/                       # Interactive React + MapLibre Map UI
│   ├── src/
│   │   ├── components/             # MapViewer, ControlPanel, MetricsCard, PolygonTable, Legend
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── kaggle/                         # Kaggle Batch Runner & Notebook
│   ├── run_pipeline_kaggle.py      # Batch inference & CSV/GeoJSON export script
│   └── mambampd_geospatial_demo.ipynb
├── models/                         # Original MambaMPD Architecture (Untouched)
├── sample_data/                    # Sample Sentinel-1 SAR raster for testing
├── train.py                        # Training script
└── eval.py                         # Evaluation script
```

---

## Running in Kaggle

Because your dataset and checkpoints are located on Kaggle, you can run the pipeline directly inside your Kaggle notebook environment:

### Option A: Run the Batch Runner in a Kaggle Notebook Cell

```bash
!python kaggle/run_pipeline_kaggle.py \
    --input_path /kaggle/input/m4d-oil-spill-detection-dataset/test/images \
    --checkpoint /kaggle/input/mambampd-checkpoints/mambampd_best.pt \
    --output_dir /kaggle/working/detections \
    --oil_threshold 0.5 \
    --min_pixel_area 5
```

This will:
* Process all SAR test rasters through MambaMPD.
* Vectorize all detected oil spill slicks into GeoJSON polygons.
* Calculate surface area in **km²** for every slick.
* Save individual GeoJSON files to `/kaggle/working/detections/geojson/`.
* Save a comprehensive summary table to `/kaggle/working/detections/oil_spill_summary.csv`.

---

## Running the Web Application (Local / Kaggle)

### 1. Start the FastAPI Backend
```bash
uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at: `http://localhost:8000/docs`

### 2. Start the React Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. You can:
1. Upload a Sentinel-1 GeoTIFF or enter a path.
2. View the SAR image mapped to its exact geographic location on Earth.
3. Toggle the colorized 5-class segmentation mask.
4. Inspect oil spill polygons, click to zoom, and download the RFC 7946 GeoJSON.
