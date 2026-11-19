import React, { useState, useEffect } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import ProjectItemsPanel from './components/ProjectItemsPanel';
import MapViewer from './components/MapViewer';
import LayersPanel from './components/LayersPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState('Map');
  const [projectItems, setProjectItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [health, setHealth] = useState(null);
  const [datasetDir, setDatasetDir] = useState(null);
  const [isInferring, setIsInferring] = useState(false);

  const [metadata, setMetadata] = useState(null);
  const [geojson, setGeojson] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
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
      if (item.cachedMetadata) setMetadata(item.cachedMetadata);
      if (item.cachedGeojson) setGeojson(item.cachedGeojson);
      if (item.cachedMask) setMaskPreviewUrl(item.cachedMask);
    } else {
      setGeojson(null);
      setMaskPreviewUrl('');
      setMetadata({
        image_id: item.id,
        filename: item.filename,
        detection_id: `OIL-${item.id}`,
        width: 512,
        height: 512,
        crs: 'EPSG:4326',
        has_georeference: false,
        total_oil_spills: 0,
        total_area_km2: 0.0,
        acquisition_date: item.date,
        satellite: item.satellite,
        resolution: item.resolution,
      });
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

      // Update item status in list to processed and cache results
      setProjectItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: 'processed',
                previewUrl: data.preview_url,
                cachedMetadata: data.metadata,
                cachedGeojson: data.geojson,
                cachedMask: data.mask_preview_url,
              }
            : it
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
