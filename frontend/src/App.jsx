import React, { useState, useEffect } from 'react';
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

  const handleToggleLayer = (layerId, isChecked) => {
    setLayers((prev) => ({ ...prev, [layerId]: isChecked }));
  };

  const handleSelectItem = async (item) => {
    setSelectedItemId(item.id);
    if (item.status === 'processed') {
      setMetadata({
        ...DEFAULT_METADATA,
        filename: item.filename,
        acquisition_date: item.date,
        satellite: item.satellite,
        resolution: item.resolution,
        detection_id: `OIL-${item.date.replace(/\s+/g, '')}-001`,
      });
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
      dimensions: '17,480 × 12,320',
      status: 'processed',
      thumbnailUrl: URL.createObjectURL(file),
    };

    setProjectItems((prev) => [newItem, ...prev]);
    setSelectedItemId(tempId);

    // Call FastAPI Backend
    const formData = new FormData();
    formData.append('file', file);
    formData.append('oil_threshold', '0.5');

    try {
      const response = await fetch('/api/detect', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        setMetadata(data.metadata);
        setGeojson(data.geojson);
        setPreviewUrl(data.preview_url);
        setMaskPreviewUrl(data.mask_preview_url);
      }
    } catch (err) {
      console.warn('Backend call failed, using local preview:', err);
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
      {/* 1. Top Navbar */}
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* 2. Main Three-Panel Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel — Project Items */}
        <ProjectItemsPanel
          items={projectItems}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          onUploadImage={handleUploadImage}
          isCollapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed(!leftCollapsed)}
        />

        {/* Center Panel — Main Geospatial Map Viewer */}
        <main className="flex-1 relative overflow-hidden">
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
