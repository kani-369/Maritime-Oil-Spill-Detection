import React, { useRef } from 'react';
import {
  ChevronsLeft,
  List,
  LayoutGrid,
  ChevronDown,
  Filter,
  Plus,
  Calendar,
  Satellite,
  Ruler,
  Maximize2,
  CheckCircle2,
  Ban,
  Layers,
  Share2,
  Zap,
  Loader2,
  Tag,
} from 'lucide-react';

export default function ProjectItemsPanel({
  items = [],
  selectedItemId,
  onSelectItem,
  onUploadImage,
  onRunInference,
  isInferring = false,
  datasetDir = null,
  isCollapsed,
  onToggleCollapse,
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onUploadImage && onUploadImage(e.target.files[0]);
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-[#09131f] border-r border-[#182a40] flex flex-col items-center py-3 gap-3 shrink-0 z-20">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand Project Items"
          className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-[#132338] transition-colors"
        >
          <ChevronsLeft className="w-4 h-4 rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Upload SAR Image"
          className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-80 bg-[#09131f] border-r border-[#182a40] flex flex-row shrink-0 z-20 select-none">
      {/* Leftmost mini-rail with quick action icons */}
      <div className="w-11 bg-[#070e17] border-r border-[#142336] flex flex-col items-center py-3 gap-2.5 shrink-0">
        <button
          type="button"
          title="Project Items"
          className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm"
        >
          <Layers className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Sensor Connections"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#0f1d2e] transition-colors"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Left Content Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Panel Header */}
        <div className="h-11 px-3.5 border-b border-[#182a40] flex items-center justify-between bg-[#0a1523]">
          <span className="text-xs font-bold text-slate-200 tracking-wider">Project Items</span>
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-[#132338] transition-colors"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Action / Filter Bar */}
        <div className="px-3 py-2 border-b border-[#182a40] flex items-center justify-between text-xs text-slate-400 bg-[#09131f]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1 rounded bg-[#132338] text-cyan-400 border border-[#1e344e]"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-[#132338]"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0d1a2d] px-2 py-1 rounded border border-[#1a2e47] text-[11px] cursor-pointer hover:border-slate-500 transition-colors">
            <span className="text-slate-300 truncate">Group by: Acquisition Date</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>

          <button
            type="button"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-[#132338]"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Upload Button */}
        <div className="p-3 border-b border-[#182a40] bg-[#0a1523]">
          <input
            ref={fileInputRef}
            type="file"
            accept=".tif,.tiff,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 px-3 bg-[#13263b] hover:bg-[#18314d] border border-[#234266] hover:border-cyan-500/50 rounded-lg text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            Upload SAR Image
          </button>
        </div>

        {/* Item Cards List */}
        <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
          {items.map((item) => {
            const isSelected = item.id === selectedItemId;
            return (
              <div
                key={item.id}
                onClick={() => onSelectItem && onSelectItem(item)}
                className={`p-2 rounded-lg border cursor-pointer transition-all flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-[#0f2136] border-cyan-500/80 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                    : 'bg-[#0b1726] border-[#18293d] hover:border-[#233c5a] hover:bg-[#0e1d30]'
                }`}
              >
                <div className="flex gap-2.5">
                  {/* Thumbnail Image */}
                  <div className="w-16 h-16 rounded overflow-hidden bg-slate-950 border border-slate-800 shrink-0 relative">
                    <img
                      src={item.thumbnailUrl || '/sample_thumb.jpg'}
                      alt={item.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="%230b192c"><rect width="64" height="64"/><circle cx="32" cy="32" r="16" fill="%231e3e62"/></svg>';
                      }}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 border border-cyan-400/40 rounded pointer-events-none" />
                    )}
                  </div>

                  {/* Technical Information */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div
                      className="text-xs font-semibold text-slate-200 truncate font-mono"
                      title={item.filename}
                    >
                      {item.filename}
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1 truncate">
                        <Calendar className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        {item.date || '2021 Apr 23'}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <Satellite className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        {item.satellite || 'Sentinel-1A'}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <Ruler className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        {item.resolution || '10 m'}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <Maximize2 className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        {item.dimensions || '512 × 512'}
                      </span>
                    </div>

                    {/* Status & GT Badges */}
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      {item.status === 'processed' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded font-medium">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Processed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/40 border border-slate-700/40 px-1.5 py-0.5 rounded font-medium">
                          <Ban className="w-2.5 h-2.5" />
                          Ready for Detection
                        </span>
                      )}

                      {item.has_ground_truth && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-purple-300 bg-purple-950/40 border border-purple-500/30 px-1.5 py-0.5 rounded font-mono">
                          <Tag className="w-2 h-2 text-purple-400" />
                          GT Label
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Explicit "Run Inference" Button for Selected Item */}
                {isSelected && (
                  <div
                    className="pt-2 border-t border-[#1a334d] flex flex-col gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={isInferring}
                      onClick={() => onRunInference && onRunInference(item)}
                      className={`w-full py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                        isInferring
                          ? 'bg-amber-600/60 text-amber-100 cursor-wait animate-pulse'
                          : item.status === 'processed'
                          ? 'bg-[#183656] hover:bg-[#204975] text-cyan-300 border border-cyan-500/50 hover:shadow-cyan-900/30'
                          : 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold shadow-amber-500/30 hover:scale-[1.01]'
                      }`}
                    >
                      {isInferring ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                          <span>MambaMPD GPU Inference Running...</span>
                        </>
                      ) : item.status === 'processed' ? (
                        <>
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Re-run MambaMPD Inference</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>⚡ Run MambaMPD Detection</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Item Count & Source */}
        <div className="h-8 px-3 border-t border-[#182a40] flex items-center justify-between text-[11px] text-slate-500 bg-[#070e17]">
          <span>{items.length} / {items.length} images</span>
          <span className="font-mono text-cyan-400/80 truncate max-w-[140px]" title={datasetDir || 'Kaggle M4D'}>
            {datasetDir ? 'Kaggle: M4D' : 'Local / Kaggle'}
          </span>
        </div>
      </div>
    </aside>
  );
}

