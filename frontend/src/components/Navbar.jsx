import React from 'react';
import { Waves, Map as MapIcon, BarChart3, Grid, FileDown, Settings, User } from 'lucide-react';

export default function Navbar({ activeTab = 'Map', onSelectTab }) {
  const tabs = [
    { name: 'Map', icon: MapIcon },
    { name: 'Analysis', icon: BarChart3 },
    { name: 'Detections', icon: Grid },
    { name: 'Exports', icon: FileDown },
  ];

  return (
    <header className="h-14 bg-[#09131f] border-b border-[#182a40] px-4 flex items-center justify-between shrink-0 z-30 select-none">
      {/* Left: Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20">
          <Waves className="w-5 h-5 fill-current" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase flex items-center gap-2">
            Maritime Oil Spill Monitoring System
          </h1>
          <p className="text-[10px] text-slate-400 font-medium">
            SAR Imagery &bull; MambaMPD (5-Class Segmentation) &bull; Geospatial Analysis
          </p>
        </div>
      </div>

      {/* Center: Top Navigation Tabs */}
      <div className="flex items-center gap-1 bg-[#0d1a2d] p-1 rounded-lg border border-[#1c304a]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.name;
          return (
            <button
              key={tab.name}
              type="button"
              onClick={() => onSelectTab && onSelectTab(tab.name)}
              className={`flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold rounded-md transition-all ${
                isActive
                  ? 'bg-[#1b3a5c] text-cyan-400 shadow-sm border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#132338]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Right: Status Pill & Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-[#0d1a2d] border border-[#1c304a] px-3 py-1 rounded-full text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <span className="text-slate-200 text-[11px] font-mono">Model Online</span>
        </div>

        <button
          type="button"
          title="System Settings"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#132338] transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="w-7 h-7 rounded-full bg-[#1b3a5c] border border-cyan-500/40 flex items-center justify-center text-cyan-300 text-xs font-bold cursor-pointer hover:ring-2 hover:ring-cyan-400/30 transition-all">
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
}

