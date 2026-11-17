import React, { useState, useRef } from 'react';
import { Upload, Play, Download, Sliders, CheckCircle, RefreshCw, FileText } from 'lucide-react';

export default function ControlPanel({
  onRunDetection,
  isLoading,
  geojsonUrl,
  layers,
  onToggleLayer,
  hasResult,
}) {
  const [file, setFile] = useState(null);
  const [filePath, setFilePath] = useState('');
  const [checkpointPath, setCheckpointPath] = useState('mambampd/mambampd_best.pt');
  const [oilThreshold, setOilThreshold] = useState(0.5);
  const [minPixelArea, setMinPixelArea] = useState(5);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFilePath('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file && !filePath.trim()) return;

    onRunDetection({
      file,
      filePath: filePath.trim() || undefined,
      checkpointPath: checkpointPath.trim() || undefined,
      oilThreshold,
      minPixelArea,
    });
  };

  return (
    <div className="bg-ocean-800/90 backdrop-blur border border-slate-700/60 rounded-xl p-4 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2 uppercase tracking-wider">
          <Sliders className="w-4 h-4 text-oil-cyan" />
          Detection Controls
        </h2>
        <span className="text-[10px] bg-cyan-500/10 text-oil-cyan border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono font-medium">
          MambaMPD
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {/* File Dropzone */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Input Sentinel-1 GeoTIFF / SAR Image
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-600 hover:border-oil-cyan/60 bg-ocean-900/50 hover:bg-ocean-900/80 rounded-lg p-3 text-center cursor-pointer transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".tif,.tiff,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="w-5 h-5 text-oil-cyan mx-auto mb-1 opacity-80" />
            <div className="text-xs text-slate-200 font-medium truncate">
              {file ? file.name : 'Click to upload GeoTIFF / SAR image'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Supports .tif (georeferenced) or M4D .jpg/.png
            </div>
          </div>
        </div>

        {/* Or direct Kaggle / Local disk path */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Or Server / Kaggle File Path
          </label>
          <input
            type="text"
            placeholder="/kaggle/input/... or test/images/img.jpg"
            value={filePath}
            onChange={(e) => {
              setFilePath(e.target.value);
              if (e.target.value) setFile(null);
            }}
            className="w-full bg-ocean-900/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-oil-cyan"
          />
        </div>

        {/* Model Checkpoint */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Trained Model Checkpoint Path
          </label>
          <input
            type="text"
            value={checkpointPath}
            onChange={(e) => setCheckpointPath(e.target.value)}
            className="w-full bg-ocean-900/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-oil-cyan"
          />
        </div>

        {/* Sliders: Threshold & Min Pixels */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <span>Threshold</span>
              <span className="font-mono text-oil-cyan">{oilThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={oilThreshold}
              onChange={(e) => setOilThreshold(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <span>Min Pixels</span>
              <span className="font-mono text-oil-cyan">{minPixelArea} px</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={minPixelArea}
              onChange={(e) => setMinPixelArea(parseInt(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Submit Run Detection Button */}
        <button
          type="submit"
          disabled={isLoading || (!file && !filePath.trim())}
          className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-ocean-900 font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-ocean-900" />
              Running MambaMPD Inference...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              Detect & Vectorize Oil Spills
            </>
          )}
        </button>
      </form>

      {/* Layer Visibility Toggles */}
      {hasResult && (
        <div className="pt-2 border-t border-slate-700/60 flex flex-col gap-2">
          <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Layer Controls
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300 bg-ocean-900/40 p-2 rounded-lg border border-slate-700/40">
            <span>SAR Imagery Layer</span>
            <input
              type="checkbox"
              checked={layers.sarImage}
              onChange={(e) => onToggleLayer('sarImage', e.target.checked)}
              className="accent-cyan-400 w-4 h-4 rounded"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300 bg-ocean-900/40 p-2 rounded-lg border border-slate-700/40">
            <span>5-Class Segmentation Mask</span>
            <input
              type="checkbox"
              checked={layers.maskOverlay}
              onChange={(e) => onToggleLayer('maskOverlay', e.target.checked)}
              className="accent-cyan-400 w-4 h-4 rounded"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300 bg-ocean-900/40 p-2 rounded-lg border border-slate-700/40">
            <span>Oil Spill Vector Polygons</span>
            <input
              type="checkbox"
              checked={layers.polygons}
              onChange={(e) => onToggleLayer('polygons', e.target.checked)}
              className="accent-cyan-400 w-4 h-4 rounded"
            />
          </div>

          {/* Download GeoJSON Button */}
          {geojsonUrl && (
            <a
              href={geojsonUrl}
              download
              className="mt-1 py-2 px-3 bg-ocean-700 hover:bg-ocean-600 border border-slate-600 rounded-lg text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-oil-cyan" />
              Export GeoJSON (RFC 7946)
            </a>
          )}
        </div>
      )}
    </div>
  );
}

