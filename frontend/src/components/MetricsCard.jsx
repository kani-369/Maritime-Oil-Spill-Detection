import React from 'react';
import { Droplet, Layers, Maximize2, Globe } from 'lucide-react';

export default function MetricsCard({ metadata }) {
  if (!metadata) return null;

  const totalArea = metadata.total_area_km2 !== undefined ? metadata.total_area_km2 : 0;
  const spillCount = metadata.total_oil_spills || 0;
  const largestSpill = metadata.largest_spill_km2 || 0;
  const crsDisplay = metadata.has_georeference ? (metadata.crs || 'WGS 84') : 'Pixel Grid (No CRS)';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {/* Total Area Card */}
      <div className="bg-ocean-800/90 backdrop-blur border border-slate-700/60 rounded-xl p-3 shadow-lg flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-oil-cyan shrink-0">
          <Droplet className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Spill Area</div>
          <div className="text-lg font-bold text-slate-100 font-mono truncate">
            {totalArea.toFixed(3)} <span className="text-xs font-normal text-slate-400">km²</span>
          </div>
        </div>
      </div>

      {/* Spill Count */}
      <div className="bg-ocean-800/90 backdrop-blur border border-slate-700/60 rounded-xl p-3 shadow-lg flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
          <Layers className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Detected Slicks</div>
          <div className="text-lg font-bold text-slate-100 font-mono truncate">
            {spillCount} <span className="text-xs font-normal text-slate-400">polygons</span>
          </div>
        </div>
      </div>

      {/* Largest Slick */}
      <div className="bg-ocean-800/90 backdrop-blur border border-slate-700/60 rounded-xl p-3 shadow-lg flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
          <Maximize2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Largest Slick</div>
          <div className="text-lg font-bold text-slate-100 font-mono truncate">
            {largestSpill.toFixed(3)} <span className="text-xs font-normal text-slate-400">km²</span>
          </div>
        </div>
      </div>

      {/* Coordinate Reference System */}
      <div className="bg-ocean-800/90 backdrop-blur border border-slate-700/60 rounded-xl p-3 shadow-lg flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <Globe className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Spatial CRS</div>
          <div className="text-sm font-semibold text-slate-200 truncate" title={crsDisplay}>
            {crsDisplay}
          </div>
        </div>
      </div>
    </div>
  );
}

