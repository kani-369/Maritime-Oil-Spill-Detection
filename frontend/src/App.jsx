import React, { useState, useEffect } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import ProjectItemsPanel from './components/ProjectItemsPanel';
import MapViewer from './components/MapViewer';
import LayersPanel from './components/LayersPanel';

// Initial realistic project items matching the reference screenshot
const INITIAL_PROJECT_ITEMS = [
  {
    id: 's1-20210423',
    filename: 'S1A_IW_GRDH_20210423T152912_20210423T152937_037580_046E3A_9B4F',
    date: '2021 Apr 23',
    satellite: 'Sentinel-1A',
    resolution: '10 m',
    dimensions: '17,480 × 12,320',
    status: 'processed',
    thumbnailUrl: '/sample_data/sentinel1_sample.png',
  },
  {
    id: 's1-20201218',
    filename: 'S1A_IW_GRDH_20201218T054522_20201218T054547_035736_042E1F_1F98',
    date: '2020 Dec 18',
    satellite: 'Sentinel-1A',
    resolution: '10 m',
    dimensions: '17,480 × 12,320',
    status: 'processed',
    thumbnailUrl: '/sample_data/sentinel1_sample.png',
  },
  {
    id: 's1-20200503',
    filename: 'S1A_IW_GRDH_20200503T181204_20200503T181229_032408_03C089_4B12',
    date: '2020 May 03',
    satellite: 'Sentinel-1A',
    resolution: '10 m',
    dimensions: '17,480 × 12,320',
    status: 'processed',
    thumbnailUrl: '/sample_data/sentinel1_sample.png',
  },
  {
    id: 's1-20200416',
    filename: 'S1A_IW_GRDH_20200416T120531_20200416T120556_032156_03B7ED_8C31',
    date: '2020 Apr 16',
    satellite: 'Sentinel-1A',
    resolution: '10 m',
    dimensions: '17,480 × 12,320',
    status: 'not_processed',
    thumbnailUrl: '/sample_data/sentinel1_sample.png',
  },
];

// Reference oil spill curved slick geometry matching the screenshot
const DEFAULT_GEOJSON = {
  type: 'FeatureCollection',
  metadata: {
    total_oil_spills: 1,
    total_area_km2: 4.08,
    crs: 'EPSG:4326',
    has_georeference: true,
  },
  features: [
    {
      type: 'Feature',
      id: 1,
      properties: {
        spill_id: 'OIL-20210423-001',
        class_id: 1,
        class_name: 'oil_spill',
        area_km2: 4.08,
        sheen_area_km2: 3.96,
        thick_area_km2: 0.12,
        mean_confidence: 0.87,
        centroid: [42.1685, 17.678],
        distance_to_shore_km: 0.0,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [42.164, 17.698],
            [42.166, 17.693],
            [42.166, 17.684],
            [42.170, 17.681],
            [42.174, 17.684],
            [42.176, 17.680],
            [42.174, 17.674],
            [42.168, 17.673],
            [42.165, 17.672],
            [42.161, 17.668],
            [42.158, 17.658],
            [42.155, 17.645],
            [42.154, 17.632],
            [42.157, 17.620],
            [42.163, 17.612],
            [42.171, 17.608],
            [42.179, 17.604],
            [42.185, 17.602],
            [42.183, 17.599],
            [42.174, 17.601],
            [42.166, 17.605],
            [42.157, 17.612],
            [42.151, 17.622],
            [42.148, 17.636],
            [42.150, 17.650],
            [42.154, 17.662],
            [42.158, 17.672],
            [42.161, 17.680],
            [42.162, 17.691],
            [42.161, 17.697],
            [42.164, 17.698],
          ],
        ],
      },
    },
  ],
};

const DEFAULT_METADATA = {
  image_id: 's1-20210423',
  filename: 'S1A_IW_GRDH_20210423T152912_20210423T152937_037580_046E3A_9B4F',
  detection_id: 'OIL-20210423-001',
  width: 17480,
  height: 12320,
  crs: 'EPSG:4326',
  has_georeference: true,
  total_oil_spills: 1,
  total_area_km2: 4.08,
  sheen_area_km2: 3.96,
  thick_area_km2: 0.12,
  perimeter_km: 28.37,
  centroid_lat_lon: '17.6842° N, 42.1759° E',
  distance_to_shore_km: 0.0,
  model_confidence: 0.87,
  acquisition_date: '2021 Apr 23',
  satellite: 'Sentinel-1A',
  polarization: 'VV, VH',
  resolution: '10 m',
  maplibre_coordinates: [
    [42.135, 17.715],
    [42.205, 17.715],
    [42.205, 17.585],
    [42.135, 17.585],
  ],
};

export default function App() {
  const [activeTab, setActiveTab] = useState('Map');
  const [projectItems, setProjectItems] = useState(INITIAL_PROJECT_ITEMS);
  const [selectedItemId, setSelectedItemId] = useState('s1-20210423');
  const [health, setHealth] = useState(null);
  const [datasetDir, setDatasetDir] = useState(null);
  const [isInferring, setIsInferring] = useState(false);

  const [metadata, setMetadata] = useState(DEFAULT_METADATA);
  const [geojson, setGeojson] = useState(DEFAULT_GEOJSON);
  const [previewUrl, setPreviewUrl] = useState('/sample_data/sentinel1_sample.png');
  const [maskPreviewUrl, setMaskPreviewUrl] = useState('');

  // Panel Collapsing State
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Layer State
  const [layers, setLayers] = useState({
    oilPrediction: true,
    oilPolygon: true,
    sarImagery: true,
    seaSurface: false,
    lookAlike: false,
    ship: false,
    land: false,
  });
  const [opacity, setOpacity] = useState(0.5);
  const [blendMode, setBlendMode] = useState('Normal');

  // Load Real Kaggle Dataset & Health on Mount
  useEffect(() => {
    const headers = { 'bypass-tunnel-reminder': 'true' };

    // 1. Fetch Health Status
    fetch('/api/health', { headers })
      .then((r) => r.json())
      .then((data) => setHealth(data))
      .catch((err) => console.warn('Health check unreachable:', err));

    // 2. Fetch Real Dataset Images from Kaggle / Local
    fetch('/api/samples', { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.samples && data.samples.length > 0) {
          setProjectItems(data.samples);
          setSelectedItemId(data.samples[0].id);
          setDatasetDir(data.dataset_dir);
          // Set preview URL to the first real image
          if (data.samples[0].previewUrl) {
            setPreviewUrl(data.samples[0].previewUrl);
          }
        }
      })
      .catch((err) => console.warn('Dataset samples unreachable:', err));
  }, []);

  const handleToggleLayer = (layerId, isChecked) => {
    setLayers((prev) => ({ ...prev, [layerId]: isChecked }));
  };

  const selectedItem = projectItems.find((it) => it.id === selectedItemId) || projectItems[0];

  const handleSelectItem = (item) => {
    setSelectedItemId(item.id);
    if (item.previewUrl) {
      setPreviewUrl(item.previewUrl);
    }
    if (item.status === 'processed') {
      setMetadata((prev) => ({
        ...prev,
        filename: item.filename,
        acquisition_date: item.date,
        satellite: item.satellite,
        resolution: item.resolution,
      }));
    }
  };

  // Run Real MambaMPD Inference on Kaggle GPU / Local Checkpoint
  const handleRunInference = async (targetItem) => {
    const item = targetItem || selectedItem;
    if (!item) return;

    setIsInferring(true);

    try {
      const formData = new FormData();
      if (item.file_path) {
        formData.append('file_path', item.file_path);
      }
      formData.append('oil_threshold', '0.5');
      formData.append('min_pixel_area', '5');

      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'bypass-tunnel-reminder': 'true' },
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setMetadata(data.metadata);
      setGeojson(data.geojson);
      setPreviewUrl(data.preview_url);
      setMaskPreviewUrl(data.mask_preview_url);

      // Update item status in list to processed
      setProjectItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: 'processed', previewUrl: data.preview_url } : it
        )
      );
    } catch (err) {
      alert(`Inference failed: ${err.message}`);
      console.error('Detection error:', err);
    } finally {
      setIsInferring(false);
    }
  };

  // Upload new SAR Image & Run Detection via Backend
  const handleUploadImage = async (file) => {
    const tempId = `s1-upload-${Date.now()}`;
    const newItem = {
      id: tempId,
      filename: file.name,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }),
      satellite: 'Sentinel-1A',
      resolution: '10 m',
      dimensions: 'Custom',
      status: 'not_processed',
      thumbnailUrl: URL.createObjectURL(file),
      previewUrl: URL.createObjectURL(file),
    };

    setProjectItems((prev) => [newItem, ...prev]);
    setSelectedItemId(tempId);
    setIsInferring(true);

    // Call FastAPI Backend
    const formData = new FormData();
    formData.append('file', file);
    formData.append('oil_threshold', '0.5');

    try {
      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'bypass-tunnel-reminder': 'true' },
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        setMetadata(data.metadata);
        setGeojson(data.geojson);
        setPreviewUrl(data.preview_url);
        setMaskPreviewUrl(data.mask_preview_url);
        setProjectItems((prev) =>
          prev.map((it) => (it.id === tempId ? { ...it, status: 'processed' } : it))
        );
      }
    } catch (err) {
      console.warn('Backend upload call failed:', err);
    } finally {
      setIsInferring(false);
    }
  };

  const handleExportGeoJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${metadata.detection_id || 'oil_spill'}.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportMask = () => {
    if (maskPreviewUrl) {
      window.open(maskPreviewUrl, '_blank');
    } else {
      alert('Prediction mask preview is generating or ready in /api/mask.');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070e17] text-slate-100 overflow-hidden font-sans">
      {/* 1. Top Navbar with Dynamic Hardware & Checkpoint Status */}
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} health={health} />

      {/* 2. Main Three-Panel Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel — Real Project Items from Kaggle Dataset */}
        <ProjectItemsPanel
          items={projectItems}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          onUploadImage={handleUploadImage}
          onRunInference={handleRunInference}
          isInferring={isInferring}
          datasetDir={datasetDir}
          isCollapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed(!leftCollapsed)}
        />

        {/* Center Panel — Main Geospatial Map Viewer */}
        <main className="flex-1 relative overflow-hidden">
          {/* Prominent Floating Action Bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-[#091524]/90 backdrop-blur-md border border-[#1b3552] rounded-full px-4 py-1.5 flex items-center gap-3 shadow-xl shadow-slate-950/60 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-slate-300 font-mono text-[11px] truncate max-w-[220px]" title={selectedItem?.filename}>
                {selectedItem?.filename || 'Select an image'}
              </span>
            </div>

            <div className="h-3 w-px bg-slate-700" />

            <button
              type="button"
              disabled={isInferring || !selectedItem}
              onClick={() => handleRunInference(selectedItem)}
              className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 text-xs transition-all ${
                isInferring
                  ? 'bg-amber-600/60 text-amber-100 cursor-wait'
                  : selectedItem?.status === 'processed'
                  ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 hover:scale-105'
              }`}
            >
              {isInferring ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>Inferring GPU...</span>
                </>
              ) : selectedItem?.status === 'processed' ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Re-run Detection</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Run Inference</span>
                </>
              )}
            </button>
          </div>

          <MapViewer
            geojson={geojson}
            metadata={metadata}
            previewUrl={previewUrl}
            maskPreviewUrl={maskPreviewUrl}
            layers={layers}
            opacity={opacity}
            blendMode={blendMode}
          />
        </main>

        {/* Right Panel — Layers and Detection Information */}
        <LayersPanel
          layers={layers}
          onToggleLayer={handleToggleLayer}
          opacity={opacity}
          onChangeOpacity={setOpacity}
          blendMode={blendMode}
          onChangeBlendMode={setBlendMode}
          metadata={metadata}
          onExportGeoJSON={handleExportGeoJSON}
          onExportMask={handleExportMask}
          isCollapsed={rightCollapsed}
          onToggleCollapse={() => setRightCollapsed(!rightCollapsed)}
        />
      </div>
    </div>
  );
}
