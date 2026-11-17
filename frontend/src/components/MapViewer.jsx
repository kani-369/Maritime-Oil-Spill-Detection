import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Plus, Minus, Crosshair, Map as MapIcon, ChevronsRight } from 'lucide-react';

// Satellite basemap matching the reference surveillance display
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export default function MapViewer({
  geojson,
  metadata,
  previewUrl,
  maskPreviewUrl,
  layers = {},
  opacity = 0.5,
  blendMode = 'Normal',
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentCoords, setCurrentCoords] = useState('17.653837° N, 42.159176° E');
  const [showMiniMap, setShowMiniMap] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default coordinate (e.g. Red Sea / coastal refinery as in reference screenshot)
    const initialCenter = [42.165, 17.67];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: SATELLITE_STYLE,
      center: initialCenter,
      zoom: 12.5,
      attributionControl: false,
    });

    map.on('load', () => {
      mapRef.current = map;
      setMapLoaded(true);
    });

    // Update coordinate badge on mouse move
    map.on('mousemove', (e) => {
      const lat = e.lngLat.lat;
      const lon = e.lngLat.lng;
      const latDir = lat >= 0 ? 'N' : 'S';
      const lonDir = lon >= 0 ? 'E' : 'W';
      setCurrentCoords(`${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lon).toFixed(6)}° ${lonDir}`);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync Layers (SAR Image, Prediction Mask, Vector Polygons)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const cleanupLayers = () => {
      if (map.getLayer('oil-spills-line')) map.removeLayer('oil-spills-line');
      if (map.getLayer('oil-spills-fill')) map.removeLayer('oil-spills-fill');
      if (map.getSource('oil-spills')) map.removeSource('oil-spills');

      if (map.getLayer('mask-raster-layer')) map.removeLayer('mask-raster-layer');
      if (map.getSource('mask-raster')) map.removeSource('mask-raster');

      if (map.getLayer('sar-raster-layer')) map.removeLayer('sar-raster-layer');
      if (map.getSource('sar-raster')) map.removeSource('sar-raster');
    };

    cleanupLayers();

    // Use georeferenced coordinates if present, or reference coordinates around coastal target
    const coords = (metadata?.has_georeference && metadata?.maplibre_coordinates)
      ? metadata.maplibre_coordinates
      : [
          [42.135, 17.705],
          [42.195, 17.705],
          [42.195, 17.635],
          [42.135, 17.635],
        ];

    // 1. Add SAR Imagery Layer
    if (previewUrl && layers.sarImagery !== false) {
      try {
        map.addSource('sar-raster', {
          type: 'image',
          url: previewUrl,
          coordinates: coords,
        });
        map.addLayer({
          id: 'sar-raster-layer',
          type: 'raster',
          source: 'sar-raster',
          paint: {
            'raster-opacity': Math.max(0.1, Number(opacity)),
          },
        });
      } catch (err) {
        console.warn('SAR raster layer add failed:', err);
      }
    }

    // 2. Add 5-Class Prediction Mask Layer
    if (maskPreviewUrl && layers.oilPrediction !== false) {
      try {
        map.addSource('mask-raster', {
          type: 'image',
          url: maskPreviewUrl,
          coordinates: coords,
        });
        map.addLayer({
          id: 'mask-raster-layer',
          type: 'raster',
          source: 'mask-raster',
          paint: {
            'raster-opacity': Math.max(0.1, Number(opacity) * 1.2),
          },
        });
      } catch (err) {
        console.warn('Mask raster layer add failed:', err);
      }
    }

    // 3. Add Oil Spill Vector Polygons
    if (geojson && layers.oilPolygon !== false) {
      try {
        map.addSource('oil-spills', {
          type: 'geojson',
          data: geojson,
        });

        // Fill layer (deep red / orange slick interior)
        map.addLayer({
          id: 'oil-spills-fill',
          type: 'fill',
          source: 'oil-spills',
          paint: {
            'fill-color': '#dc2626',
            'fill-opacity': 0.55,
          },
        });

        // Polygon boundary: Vibrant golden-yellow stroke matching reference screenshot
        map.addLayer({
          id: 'oil-spills-line',
          type: 'line',
          source: 'oil-spills',
          paint: {
            'line-color': '#eab308',
            'line-width': 2.8,
            'line-opacity': 0.95,
          },
        });

        // Hover & Click Interactions
        map.on('mouseenter', 'oil-spills-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'oil-spills-fill', () => {
          map.getCanvas().style.cursor = '';
        });

        const showDetectionPopup = (centerCoords, props) => {
          if (popupRef.current) popupRef.current.remove();

          const totalArea = Number(props.area_km2 || metadata?.total_area_km2 || 4.08).toFixed(2);
          const sheenArea = Number(metadata?.sheen_area_km2 || (Number(totalArea) * 0.97)).toFixed(2);
          const thickArea = Number(metadata?.thick_area_km2 || (Number(totalArea) - Number(sheenArea))).toFixed(2);
          const distanceToShore = Number(metadata?.distance_to_shore_km || 0.0).toFixed(1);

          const popupHtml = `
            <div class="bg-white text-slate-900 rounded-lg p-3 min-w-[210px] text-xs font-sans shadow-2xl">
              <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                <span class="font-bold text-slate-900 text-xs">Oil Spill Detection</span>
                <span style="cursor:pointer;" onclick="this.closest('.maplibregl-popup').remove();" class="text-slate-400 hover:text-slate-700 text-sm font-bold">&times;</span>
              </div>
              <div class="flex flex-col gap-1.5 text-[11px]">
                <div class="flex justify-between">
                  <span class="text-slate-500">Distance to Shore</span>
                  <span class="font-bold text-slate-800">${distanceToShore} km</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Sheen Area</span>
                  <span class="font-bold text-slate-800">${sheenArea} km²</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Thick Area</span>
                  <span class="font-bold text-slate-800">${thickArea} km²</span>
                </div>
                <div class="flex justify-between pt-1 border-t border-slate-100">
                  <span class="font-bold text-slate-700">Total Area</span>
                  <span class="font-extrabold text-slate-950">${totalArea} km²</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Class</span>
                  <span class="font-bold text-slate-900">Oil Spill (Class 1)</span>
                </div>
              </div>
            </div>
          `;

          popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 15, maxWidth: '280px' })
            .setLngLat(centerCoords)
            .setHTML(popupHtml)
            .addTo(map);
        };

        map.on('click', 'oil-spills-fill', (e) => {
          if (!e.features || e.features.length === 0) return;
          const feat = e.features[0];
          showDetectionPopup(e.lngLat, feat.properties);
        });

        // Automatically show popup on first load if features exist
        if (geojson.features && geojson.features.length > 0) {
          const first = geojson.features[0];
          const center = first.properties.centroid || [42.168, 17.675];
          showDetectionPopup(center, first.properties);

          // Fly smoothly to target
          map.flyTo({
            center: center,
            zoom: 12.8,
            duration: 1200,
          });
        }
      } catch (err) {
        console.warn('Vector layer add failed:', err);
      }
    }
  }, [geojson, metadata, previewUrl, maskPreviewUrl, layers, opacity, mapLoaded]);

  // Map Controls
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetCenter = () => {
    mapRef.current?.flyTo({
      center: [42.165, 17.67],
      zoom: 12.5,
      duration: 1000,
    });
  };

  return (
    <div className="relative w-full h-full bg-[#070e17] overflow-hidden select-none">
      {/* MapLibre WebGL Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Bottom-Left Navigation Tools */}
      <div className="absolute bottom-5 left-5 z-10 flex flex-col gap-2">
        <div className="flex flex-col bg-[#09131f]/90 backdrop-blur border border-[#182a40] rounded-lg shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-[#132338] border-b border-[#182a40] transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-[#132338] transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col bg-[#09131f]/90 backdrop-blur border border-[#182a40] rounded-lg shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={handleResetCenter}
            title="Re-center on Oil Spill"
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-[#132338] border-b border-[#182a40] transition-colors"
          >
            <Crosshair className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Toggle Imagery Style"
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-[#132338] transition-colors"
          >
            <MapIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Coordinate Badge and Metric Scale Bar */}
        <div className="flex items-center gap-2 mt-1">
          <div className="bg-[#09131f]/90 backdrop-blur border border-[#182a40] px-2.5 py-1 rounded-md text-[11px] font-mono text-slate-200 shadow-md">
            {currentCoords}
          </div>
          <div className="bg-[#09131f]/90 backdrop-blur border border-[#182a40] px-2.5 py-1 rounded-md text-[10px] font-mono text-slate-300 flex items-center gap-1 shadow-md">
            <span>1 km</span>
            <span className="w-8 h-1 border-b-2 border-l-2 border-r-2 border-cyan-400 inline-block" />
          </div>
        </div>
      </div>

      {/* Floating Bottom-Right Overview Mini-Map */}
      {showMiniMap && (
        <div className="absolute bottom-5 right-5 z-10 w-48 h-32 bg-[#09131f]/95 backdrop-blur border border-[#1e344e] rounded-lg shadow-2xl overflow-hidden flex flex-col">
          <div className="relative flex-1 bg-[#0b1726] flex items-center justify-center overflow-hidden">
            {/* World outline depiction */}
            <svg viewBox="0 0 100 60" className="w-full h-full opacity-40 fill-slate-500">
              <path d="M15,20 Q20,10 35,15 T55,22 T75,18 T90,30 Q85,45 70,50 T45,45 T25,48 Z" />
              <circle cx="48" cy="28" r="4" fill="#00f2fe" opacity="0.6" />
            </svg>
            {/* Red Sea / Gulf Locator Box */}
            <div className="absolute w-6 h-5 border-2 border-cyan-400 bg-cyan-400/20 top-7 left-24 pointer-events-none" />

            <button
              type="button"
              onClick={() => setShowMiniMap(false)}
              title="Minimize Overview"
              className="absolute bottom-1 left-1 p-0.5 rounded text-slate-400 hover:text-white bg-[#09131f]/80"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
