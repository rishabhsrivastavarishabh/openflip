import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ImageFilterProps {
  imageUrl: string;
  onFilterChange: (filter: FilterSettings) => void;
  className?: string;
}

export interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  preset: string | null;
}

export const presetFilters = {
  none: { brightness: 100, contrast: 100, saturation: 100 },
  clarendon: { brightness: 105, contrast: 115, saturation: 120 },
  gingham: { brightness: 105, contrast: 95, saturation: 90 },
  moon: { brightness: 110, contrast: 100, saturation: 0 },
  lark: { brightness: 108, contrast: 103, saturation: 105 },
  reyes: { brightness: 110, contrast: 90, saturation: 85 },
  juno: { brightness: 100, contrast: 115, saturation: 120 },
  slumber: { brightness: 105, contrast: 95, saturation: 80 },
  crema: { brightness: 105, contrast: 100, saturation: 95 },
  ludwig: { brightness: 105, contrast: 105, saturation: 105 },
  aden: { brightness: 115, contrast: 85, saturation: 90 },
  perpetua: { brightness: 105, contrast: 110, saturation: 105 },
};

export function ImageFilter({ imageUrl, onFilterChange, className }: ImageFilterProps) {
  const [filter, setFilter] = useState<FilterSettings>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    preset: null,
  });

  const updateFilter = (updates: Partial<FilterSettings>) => {
    const newFilter = { ...filter, ...updates };
    setFilter(newFilter);
    onFilterChange(newFilter);
  };

  const applyPreset = (presetName: string) => {
    const preset = presetFilters[presetName as keyof typeof presetFilters];
    const newFilter = {
      ...preset,
      preset: presetName === 'none' ? null : presetName,
    };
    setFilter(newFilter);
    onFilterChange(newFilter);
  };

  const filterStyle = {
    filter: `brightness(${filter.brightness}%) contrast(${filter.contrast}%) saturate(${filter.saturation}%)`,
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Preview */}
      <div className="aspect-square rounded-lg overflow-hidden bg-black">
        <img
          src={imageUrl}
          alt="Preview"
          className="w-full h-full object-contain transition-all duration-200"
          style={filterStyle}
        />
      </div>

      {/* Preset filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
        {Object.keys(presetFilters).map((presetName) => (
          <button
            key={presetName}
            onClick={() => applyPreset(presetName)}
            className={cn(
              "flex flex-col items-center gap-1 shrink-0",
              filter.preset === presetName && "text-primary"
            )}
          >
            <div
              className={cn(
                "w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors",
                filter.preset === presetName || (presetName === 'none' && !filter.preset)
                  ? "border-primary"
                  : "border-transparent"
              )}
            >
              <img
                src={imageUrl}
                alt={presetName}
                className="w-full h-full object-cover"
                style={{
                  filter: `brightness(${presetFilters[presetName as keyof typeof presetFilters].brightness}%) contrast(${presetFilters[presetName as keyof typeof presetFilters].contrast}%) saturate(${presetFilters[presetName as keyof typeof presetFilters].saturation}%)`,
                }}
              />
            </div>
            <span className="text-xs capitalize">{presetName}</span>
          </button>
        ))}
      </div>

      {/* Manual adjustments */}
      <div className="space-y-4 px-2">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Brightness</span>
            <span>{filter.brightness}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="150"
            value={filter.brightness}
            onChange={(e) => updateFilter({ brightness: Number(e.target.value), preset: null })}
            className="w-full accent-primary"
          />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Contrast</span>
            <span>{filter.contrast}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="150"
            value={filter.contrast}
            onChange={(e) => updateFilter({ contrast: Number(e.target.value), preset: null })}
            className="w-full accent-primary"
          />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Saturation</span>
            <span>{filter.saturation}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={filter.saturation}
            onChange={(e) => updateFilter({ saturation: Number(e.target.value), preset: null })}
            className="w-full accent-primary"
          />
        </div>
      </div>
    </div>
  );
}

export function applyFilterToCanvas(
  imageUrl: string,
  filter: FilterSettings
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.filter = `brightness(${filter.brightness}%) contrast(${filter.contrast}%) saturate(${filter.saturation}%)`;
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.9
      );
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}
