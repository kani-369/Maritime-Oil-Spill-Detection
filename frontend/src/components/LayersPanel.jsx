import React, { useState } from 'react';
import {
  ChevronsRight,
  Eye,
  EyeOff,
  MoreVertical,
  Sun,
  FileDown,
  ChevronDown,
  Layers as LayersIcon,
  LayoutGrid,
  List,
} from 'lucide-react';

const LAYER_CONFIGS = [
  { id: 'oilPrediction', name: 'Oil Spill (Prediction)', color: '#dc2626', defaultActive: true },
  { id: 'oilPolygon', name: 'Oil Spill Polygon', color: '#eab308', defaultActive: true },
  { id: 'sarImagery', name: 'SAR Imagery (Sentinel-1)', color: '#1e3a8a', defaultActive: true },
  { id: 'seaSurface', name: 'Sea Surface (Class 0)', color: '#0f172a', defaultActive: false },
  { id: 'lookAlike', name: 'Look-alike (Class 2)', color: '#8b5cf6', defaultActive: false },
  { id: 'ship', name: 'Ship (Class 3)', color: '#0284c7', defaultActive: false },
  { id: 'land', name: 'Land (Class 4)', color: '#b45309', defaultActive: false },
];

export default function LayersPanel({
  layers,
  onToggleLayer,
  opacity,
  onChangeOpacity,
  blendMode,
  onChangeBlendMode,
  metadata,
  onExportGeoJSON,
  onExportMask,
  isCollapsed,
  onToggleCollapse,
}) {
  const [detectionOpen, setDetectionOpen] = useState(true);

  if (isCollapsed) {
    return (
      <div className="w-12 bg-[#09131f] border-l border-[#182a40] flex flex-col items-center py-3 gap-3 shrink-0 z-20">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand Layers Panel"
          className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-[#132338] transition-colors"
        >
          <ChevronsRight className="w-4 h-4 rotate-180" />
        </button>
        <button
          type="button"
          title="Layers"
          className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
        >
          <LayersIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Telemetry items matching the reference screenshot exactly
  const detectionFields = [
    { label: 'Detection ID', value: metadata?.detection_id || 'OIL-20210423-001' },
    {
      label: 'Oil Spill Area',
      value: metadata?.total_area_km2 !== undefined ? `${Number(metadata.total_area_km2).toFixed(2)} km²` : '4.08 km²',
      highlight: true,
    },
    {
      label: 'Sheen Area',
      value: metadata?.sheen_area_km2 !== undefined ? `${Number(metadata.sheen_area_km2).toFixed(2)} km²` : '3.96 km²',
    },
    {
      label: 'Thick Area',
      value: metadata?.thick_area_km2 !== undefined ? `${Number(metadata.thick_area_km2).toFixed(2)} km²` : '0.12 km²',
    },
    {
      label: 'Perimeter',
      value: metadata?.perimeter_km !== undefined ? `${Number(metadata.perimeter_km).toFixed(2)} km` : '28.37 km',
    },
    {
      label: 'Centroid (Lat, Lon)',
      value: metadata?.centroid_lat_lon || '17.6842° N, 42.1759° E',
      mono: true,
    },
    {
      label: 'Distance to Shore',
      value: metadata?.distance_to_shore_km !== undefined ? `${Number(metadata.distance_to_shore_km).toFixed(1)} km` : '0.0 km',
    },
    {
      label: 'Model Confidence',
      value: metadata?.model_confidence !== undefined ? `${Number(metadata.model_confidence).toFixed(2)}` : '0.87',
      mono: true,
    },
    {
      label: 'Acquisition Date',
      value: metadata?.acquisition_date || '2021 Apr 23',
    },
    {
      label: 'Satellite',
      value: metadata?.satellite || 'Sentinel-1A',
    },
    {
      label: 'Polarization',
      value: metadata?.polarization || 'VV, VH',
    },
    {
      label: 'Resolution',
      value: metadata?.resolution || '10 m',
    },
    ...(metadata?.latency_ms !== undefined
      ? [{ label: 'Inference Latency', value: `${metadata.latency_ms} ms`, mono: true, highlight: true }]
      : []),
    ...(metadata?.device
      ? [{ label: 'Compute Device', value: metadata.device, mono: true }]
      : []),
    ...(metadata?.checkpoint_loaded
      ? [{ label: 'Model Checkpoint', value: metadata.checkpoint_loaded, mono: true }]
      : []),
  ];

  return (
    <aside className="w-80 bg-[#09131f] border-l border-[#182a40] flex flex-row shrink-0 z-20 select-none">
      {/* Main Right Content Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Panel Header */}
        <div className="h-11 px-3.5 border-b border-[#182a40] flex items-center justify-between bg-[#0a1523]">
          <span className="text-xs font-bold text-slate-200 tracking-wider">Layers</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#132338]"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#132338]"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse Panel"
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#132338]"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-[#182a40]">
          {/* Section 1: Layers Controls & List */}
          <div className="p-3.5 flex flex-col gap-3 bg-[#09131f]">
            {/* Blend Mode Dropdown */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Blend mode</span>
              <select
                value={blendMode}
                onChange={(e) => onChangeBlendMode && onChangeBlendMode(e.target.value)}
                className="bg-[#0e1d30] border border-[#1e344e] text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="Normal">Normal</option>
                <option value="Multiply">Multiply</option>
                <option value="Screen">Screen</option>
                <option value="Overlay">Overlay</option>
              </select>
            </div>

            {/* Opacity Slider */}
            <div className="flex items-center gap-2.5 text-xs">
              <span className="text-slate-400 font-medium">Opacity</span>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => onChangeOpacity && onChangeOpacity(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-[#1a2f47] rounded cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-300 w-7 text-right">
                  {opacity.toFixed(1)}
                </span>
              </div>
              <Sun className="w-4 h-4 text-slate-400" />
            </div>

            {/* Layer Checkboxes List */}
            <div className="flex flex-col gap-1.5 mt-1">
              {LAYER_CONFIGS.map((layer) => {
                const isActive = layers[layer.id] !== undefined ? layers[layer.id] : layer.defaultActive;
                return (
                  <div
                    key={layer.id}
                    className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#0d1c2e] transition-colors group text-xs"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => onToggleLayer && onToggleLayer(layer.id, e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-cyan-500 bg-[#0a1523] border-[#223d5e] cursor-pointer"
                      />
                      {/* Color indicator swatch */}
                      <span
                        className="w-3 h-3 rounded-sm shrink-0 border border-black/40"
                        style={{ backgroundColor: layer.color }}
                      />
                      <span
                        className={`truncate ${
                          isActive ? 'text-slate-200 font-medium' : 'text-slate-400'
                        }`}
                      >
                        {layer.name}
                      </span>
                    </label>

                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onToggleLayer && onToggleLayer(layer.id, !isActive)}
                        className="p-1 text-slate-400 hover:text-slate-200"
                      >
                        {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        className="p-1 text-slate-500 hover:text-slate-300"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Detection Information */}
          <div className="flex flex-col bg-[#09131f]">
            <button
              type="button"
              onClick={() => setDetectionOpen(!detectionOpen)}
              className="h-10 px-3.5 flex items-center justify-between text-xs font-bold text-slate-200 hover:bg-[#0c1a2b] transition-colors bg-[#0a1523]"
            >
              <span>Detection Information</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  detectionOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {detectionOpen && (
              <div className="p-3.5 flex flex-col divide-y divide-[#142338] text-xs">
                {detectionFields.map((field) => (
                  <div
                    key={field.label}
                    className="py-1.5 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-400 text-[11px]">{field.label}</span>
                    <span
                      className={`text-[11px] text-right truncate ${
                        field.highlight
                          ? 'text-cyan-400 font-bold'
                          : field.mono
                          ? 'font-mono text-slate-200'
                          : 'text-slate-200 font-medium'
                      }`}
                    >
                      {field.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="p-3 border-t border-[#182a40] bg-[#070e17] flex items-center gap-2">
          <button
            type="button"
            onClick={onExportGeoJSON}
            className="flex-1 py-2 px-2.5 bg-[#102236] hover:bg-[#16304d] border border-[#1e3d63] hover:border-cyan-500/50 rounded-lg text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5 text-cyan-400" />
            Export GeoJSON
          </button>

          <button
            type="button"
            onClick={onExportMask}
            className="flex-1 py-2 px-2.5 bg-[#102236] hover:bg-[#16304d] border border-[#1e3d63] hover:border-cyan-500/50 rounded-lg text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-400" />
            Export Mask
          </button>
        </div>
      </div>

      {/* Rightmost mini-rail with quick action icons */}
      <div className="w-11 bg-[#070e17] border-l border-[#142336] flex flex-col items-center py-3 gap-2.5 shrink-0">
        <button
          type="button"
          title="Layer Stack"
          className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm"
        >
          <LayersIcon className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}

