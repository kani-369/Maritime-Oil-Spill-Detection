import React from 'react';
import { Crosshair, AlertCircle } from 'lucide-react';

export default function PolygonTable({ features = [], onSelectFeature, selectedFeatureId }) {
  if (!features || features.length === 0) {
    return (
      <div className="bg-ocean-800/60 border border-slate-700/60 rounded-xl p-4 text-center">
        <AlertCircle className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
        <p className="text-xs text-slate-400">No oil spill polygons detected in this image.</p>
      </div>
    );
  }

  // Sort by area descending
  const sorted = [...features].sort((a, b) => (b.properties.area_km2 || 0) - (a.properties.area_km2 || 0));

  return (
    <div className="bg-ocean-800/90 backdrop-blur border border-slate-700/60 rounded-xl overflow-hidden shadow-xl flex flex-col max-h-64">
      <div className="p-2.5 border-b border-slate-700/60 flex items-center justify-between bg-ocean-900/40">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Detected Slicks ({features.length})
        </span>
        <span className="text-[10px] text-slate-400 font-mono">Sorted by Area</span>
      </div>

      <div className="overflow-y-auto divide-y divide-slate-700/40 flex-1">
        {sorted.map((feat) => {
          const props = feat.properties;
          const isSelected = selectedFeatureId === feat.id;
          const [lon, lat] = props.centroid || [0, 0];

          return (
            <div
              key={feat.id}
              onClick={() => onSelectFeature && onSelectFeature(feat)}
              className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-cyan-500/15 border-l-2 border-oil-cyan text-white'
                  : 'hover:bg-ocean-700/50 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-oil-cyan text-[10px] font-mono flex items-center justify-center font-bold">
                  #{feat.id}
                </span>
                <div>
                  <div className="font-semibold text-slate-200">
                    {props.area_km2.toFixed(4)} <span className="text-[10px] text-slate-400">km²</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    [{lon.toFixed(4)}, {lat.toFixed(4)}]
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Confidence</div>
                  <div className="text-xs font-mono font-medium text-emerald-400">
                    {(props.mean_confidence * 100).toFixed(1)}%
                  </div>
                </div>
                <button
                  type="button"
                  title="Center on Map"
                  className="p-1 rounded bg-ocean-700/60 hover:bg-cyan-500/20 text-slate-400 hover:text-oil-cyan transition-colors"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

