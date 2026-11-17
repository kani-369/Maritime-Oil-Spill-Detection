import React from 'react';

const CLASSES = [
  { id: 0, name: 'Sea Surface', color: '#1e3e62', border: '#2563eb', desc: 'Background open water' },
  { id: 1, name: 'Oil Spill', color: '#00ffff', border: '#00f2fe', desc: 'Petroleum / crude slick' },
  { id: 2, name: 'Look-alike', color: '#ef4444', border: '#dc2626', desc: 'Biogenic / low-wind film' },
  { id: 3, name: 'Ship', color: '#f59e0b', border: '#d97706', desc: 'Vessels / maritime platforms' },
  { id: 4, name: 'Land', color: '#22c55e', border: '#16a34a', desc: 'Coastline / terrestrial land' },
];

export default function Legend({ activeClass = 1 }) {
  return (
    <div className="bg-ocean-800/90 backdrop-blur border border-slate-700/60 rounded-xl p-3 shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">M4D 5-Class Legend</span>
        <span className="text-[10px] text-oil-cyan font-mono">MambaMPD</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {CLASSES.map((cls) => {
          const isTarget = cls.id === activeClass;
          return (
            <div
              key={cls.id}
              className={`flex flex-col items-center p-1.5 rounded-lg border text-center transition-all ${
                isTarget
                  ? 'bg-ocean-700/80 border-oil-cyan/80 ring-1 ring-oil-cyan/40 shadow-sm'
                  : 'bg-ocean-900/40 border-slate-700/40 opacity-75 hover:opacity-100'
              }`}
            >
              <div
                className="w-3.5 h-3.5 rounded-full mb-1 shadow-sm"
                style={{ backgroundColor: cls.color, border: `1px solid ${cls.border}` }}
              />
              <span className="text-[11px] font-medium text-slate-200 truncate w-full">{cls.name}</span>
              <span className="text-[9px] text-slate-400 font-mono">ID {cls.id}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

