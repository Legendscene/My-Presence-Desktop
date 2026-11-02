import { useCallback, useState } from 'react';
import {
  Check, Copy, Image, Import, Plus, RotateCcw, Sparkles, Trash2, Upload, Video, Volume2, VolumeX
} from 'lucide-react';
import { useAppStore, useActiveTheme } from '../../lib/store';
import { bytesToBase64 } from '../../lib/gifCrop';
import { isPlayableVideoUrl } from '../../lib/media';
import type { BackgroundType, Theme, VideoFit } from '../../lib/types';
import { TextInput } from '../ui/forms';

const TYPE_OPTIONS: { value: BackgroundType; label: string; hint: string }[] = [
  { value: 'video', label: 'Video', hint: 'Animated wallpaper' },
  { value: 'image', label: 'Image', hint: 'Static picture' },
  { value: 'gradient', label: 'Gradient', hint: 'Two-colour blend' },
  { value: 'solid', label: 'Solid', hint: 'Single colour' }
];

const FIT_OPTIONS: { value: VideoFit; label: string }[] = [
  { value: 'fill', label: 'Fill' },
  { value: 'fit', label: 'Fit' },
  { value: 'blur', label: 'Blur fill' }
];

// Hand-picked blends so a good-looking gradient is one click away instead of
// requiring the colour pickers.
const GRADIENT_PRESETS: { name: string; start: string; end: string; angle: number }[] = [
  { name: 'Aurora', start: '#0f0c29', end: '#302b63', angle: 135 },
  { name: 'Sunset', start: '#ff6a00', end: '#ee0979', angle: 120 },
  { name: 'Ocean', start: '#0f2027', end: '#2c5364', angle: 160 },
  { name: 'Ember', start: '#200122', end: '#6f0000', angle: 145 },
  { name: 'Peach', start: '#ffd6a5', end: '#ff6b6b', angle: 135 },
  { name: 'Mint', start: '#134e5e', end: '#71b280', angle: 160 },
  { name: 'Neon', start: '#8e2de2', end: '#4a00e0', angle: 90 },
  { name: 'Ink', start: '#232526', end: '#414345', angle: 135 }
];

export function BackgroundView() {
  const themes = useAppStore((s) => s.themes);
  const settings = useAppStore((s) => s.settings);
  const createTheme = useAppStore((s) => s.createTheme);
  const deleteTheme = useAppStore((s) => s.deleteTheme);
  const duplicateTheme = useAppStore((s) => s.duplicateTheme);
  const updateTheme = useAppStore((s) => s.updateTheme);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const importTheme = useAppStore((s) => s.importTheme);
  const resetDefaultTheme = useAppStore((s) => s.resetDefaultTheme);
  const activeTheme = useActiveTheme();

  const [importError, setImportError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const patch = useCallback(
    (id: string, changes: Partial<Theme>) => updateTheme(id, (t) => ({ ...t, ...changes })),
    [updateTheme]
  );

  const handleImagePick = useCallback(async (themeId: string) => {
    const bridge = window.myPresenceDesktop;
    if (!bridge?.uploadImage) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) patch(themeId, { imageUrl: URL.createObjectURL(file), backgroundType: 'image' });
      };
      input.click();
      return;
    }
    const result = await bridge.uploadImage();
    if (result.ok) patch(themeId, { imageUrl: result.url, backgroundType: 'image' });
    else if (!('canceled' in result)) setImportError(result.error);
  }, [patch]);

  const handleVideoPick = useCallback(async (themeId: string) => {
    const bridge = window.myPresenceDesktop;
    if (!bridge?.uploadVideo) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/mp4,video/webm,video/quicktime';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) patch(themeId, { videoUrl: URL.createObjectURL(file), backgroundType: 'video' });
      };
      input.click();
      return;
    }
    const result = await bridge.uploadVideo();
    if (result.ok) patch(themeId, { videoUrl: result.url, backgroundType: 'video' });
    else if (!('canceled' in result)) setImportError(result.error);
  }, [patch]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ok = importTheme(reader.result as string);
        setImportError(ok ? '' : 'That file is not a valid theme.');
      };
      reader.readAsText(file);
    };
    input.click();
  }, [importTheme]);

  const handleCreateAndActivate = useCallback(() => {
    createTheme();
    // createTheme appends, so the new one is last - taking [0] activated
    // whichever theme happened to sort first instead.
    const created = useAppStore.getState().themes.at(-1);
    if (created) setActiveTheme(created.id);
  }, [createTheme, setActiveTheme]);

  const handleDrop = useCallback(async (e: React.DragEvent, themeId: string) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (file.type.startsWith('image/')) {
      const bridge = window.myPresenceDesktop;
      if (bridge?.uploadImageBytes) {
        const result = await bridge.uploadImageBytes(bytesToBase64(bytes), file.type);
        if (result.ok) patch(themeId, { imageUrl: result.url, backgroundType: 'image' });
        else if (!('canceled' in result)) setImportError(result.error);
      } else {
        patch(themeId, { imageUrl: URL.createObjectURL(file), backgroundType: 'image' });
      }
      return;
    }

    if (file.type.startsWith('video/')) {
      const bridge = window.myPresenceDesktop;
      if (bridge?.saveVideoBytes) {
        // A blob: URL would be written into the theme and be dead on the next
        // launch, so hand the bytes to the main process to persist.
        const result = await bridge.saveVideoBytes(bytesToBase64(bytes), file.name);
        if (result.ok) patch(themeId, { videoUrl: result.url, backgroundType: 'video' });
        else if (!('canceled' in result)) setImportError(result.error);
      } else {
        patch(themeId, { videoUrl: URL.createObjectURL(file), backgroundType: 'video' });
      }
    }
  }, [patch]);

  const type = activeTheme?.backgroundType;
  const isVideo = type === 'video' || type === 'video-url';
  const isImage = type === 'image';
  const hasOverlay = (activeTheme?.overlayOpacity ?? 0) > 0;

  return (
    <div className="bg-view">
      <section className="bg-section bg-section-hero">
        <div
          className="bg-hero-preview"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => activeTheme && handleDrop(e, activeTheme.id)}
        >
          <BackgroundPreview theme={activeTheme} />
          <div className={`bg-drop-overlay ${dragOver ? 'drag-over' : ''}`}>
            <Upload size={24} />
            <span>Drop an image or video</span>
          </div>
        </div>
        <p className="bg-hero-hint">Drag an image or video onto this preview to use it.</p>
      </section>

      <section className="bg-section">
        <h3 className="bg-section-label">Background type</h3>
        <div className="bg-type-grid">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`bg-type-card ${type === option.value ? 'active' : ''}`}
              onClick={() => activeTheme && patch(activeTheme.id, { backgroundType: option.value })}
              disabled={!activeTheme}
            >
              {option.value === 'video'
                ? <Video size={18} />
                : option.value === 'image'
                  ? <Image size={18} />
                  : <Sparkles size={18} />}
              <span>{option.label}</span>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
      </section>

      {activeTheme && (
        <section className="bg-section bg-section-controls">
          <div className="bg-panel-header">
            <h3 className="bg-section-label">Source</h3>
            <button className="bg-action-btn" onClick={resetDefaultTheme} title="Restore the bundled wallpaper">
              <RotateCcw size={13} /> Reset
            </button>
          </div>

          {isImage && (
            <div className="bg-upload-area">
              <button className="ui-button ui-button--outline ui-button--md" onClick={() => handleImagePick(activeTheme.id)}>
                <Upload size={14} /> Choose Image
              </button>
              <TextInput
                value={activeTheme.imageUrl}
                onChange={(e) => patch(activeTheme.id, { imageUrl: e.target.value })}
                placeholder="...or paste an image URL"
              />
            </div>
          )}

          {isVideo && (
            <>
              <div className="bg-upload-area">
                <button className="ui-button ui-button--outline ui-button--md" onClick={() => handleVideoPick(activeTheme.id)}>
                  <Video size={14} /> Choose Video
                </button>
                <TextInput
                  value={activeTheme.videoUrl}
                  onChange={(e) => patch(activeTheme.id, { videoUrl: e.target.value })}
                  placeholder="...or paste a video URL"
                />
              </div>

              <div className="bg-fit-row">
                <label>Fit</label>
                <div className="bg-segmented">
                  {FIT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className={activeTheme.videoFit === option.value ? 'active' : ''}
                      onClick={() => patch(activeTheme.id, { videoFit: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-video-toggles">
                <label className="bg-toggle">
                  <input
                    type="checkbox"
                    checked={activeTheme.loop}
                    onChange={(e) => patch(activeTheme.id, { loop: e.target.checked })}
                  />
                  <span>Loop</span>
                </label>
                {/* One control, not two: "Mute" and "Audio" used to be the same
                    setting expressed inversely, so toggling either undid the other. */}
                <label className="bg-toggle">
                  <input
                    type="checkbox"
                    checked={!activeTheme.muted}
                    onChange={(e) => patch(activeTheme.id, {
                      muted: !e.target.checked,
                      volume: e.target.checked && activeTheme.volume === 0 ? 50 : activeTheme.volume
                    })}
                  />
                  <span>{activeTheme.muted ? <VolumeX size={12} /> : <Volume2 size={12} />} Sound</span>
                </label>
              </div>

              {!activeTheme.muted && (
                <SliderRow
                  label="Volume"
                  value={activeTheme.volume}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(volume) => patch(activeTheme.id, { volume })}
                />
              )}

              <SliderRow
                label="Playback speed"
                value={activeTheme.playbackSpeed}
                min={0.25}
                max={3}
                step={0.05}
                suffix="x"
                onChange={(playbackSpeed) => patch(activeTheme.id, { playbackSpeed })}
              />
            </>
          )}

          {type === 'solid' && (
            <ColorRow
              label="Colour"
              value={activeTheme.solidColor}
              onChange={(solidColor) => patch(activeTheme.id, { solidColor })}
            />
          )}

          {type === 'gradient' && (
            <>
              <div className="bg-preset-grid">
                {GRADIENT_PRESETS.map((preset) => {
                  const active =
                    activeTheme.gradientStart === preset.start && activeTheme.gradientEnd === preset.end;
                  return (
                    <button
                      key={preset.name}
                      className={`bg-preset ${active ? 'active' : ''}`}
                      style={{ background: `linear-gradient(${preset.angle}deg, ${preset.start}, ${preset.end})` }}
                      onClick={() => patch(activeTheme.id, {
                        gradientStart: preset.start,
                        gradientEnd: preset.end,
                        gradientAngle: preset.angle
                      })}
                      title={preset.name}
                    >
                      {active && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
              <ColorRow
                label="From"
                value={activeTheme.gradientStart}
                onChange={(gradientStart) => patch(activeTheme.id, { gradientStart })}
              />
              <ColorRow
                label="To"
                value={activeTheme.gradientEnd}
                onChange={(gradientEnd) => patch(activeTheme.id, { gradientEnd })}
              />
              <SliderRow
                label="Angle"
                value={activeTheme.gradientAngle}
                min={0}
                max={360}
                suffix="deg"
                onChange={(gradientAngle) => patch(activeTheme.id, { gradientAngle })}
              />
            </>
          )}
        </section>
      )}

      {activeTheme && (
        <section className="bg-section bg-section-controls">
          <h3 className="bg-section-label">Overlay</h3>
          <SliderRow
            label="Darkness"
            value={activeTheme.overlayOpacity}
            min={0}
            max={100}
            suffix="%"
            onChange={(overlayOpacity) => patch(activeTheme.id, { overlayOpacity })}
          />
          {hasOverlay && (
            <ColorRow
              label="Overlay colour"
              value={activeTheme.overlayColor}
              onChange={(overlayColor) => patch(activeTheme.id, { overlayColor })}
            />
          )}
          <p className="bg-note">Controls contrast so app content stays readable on bright backgrounds.</p>
        </section>
      )}

      {activeTheme && (
        <section className="bg-section bg-section-controls">
          <h3 className="bg-section-label">Interface</h3>
          <ColorRow
            label="Accent"
            value={activeTheme.accentColor}
            onChange={(accentColor) => patch(activeTheme.id, { accentColor })}
          />
          <SliderRow
            label="Glass blur"
            value={activeTheme.glassStrength}
            min={0}
            max={40}
            suffix="px"
            onChange={(glassStrength) => patch(activeTheme.id, { glassStrength })}
          />
          <SliderRow
            label="Corner radius"
            value={activeTheme.cornerRadius}
            min={0}
            max={28}
            suffix="px"
            onChange={(cornerRadius) => patch(activeTheme.id, { cornerRadius })}
          />
        </section>
      )}

      {activeTheme && (
        <section className="bg-section bg-section-controls">
          <h3 className="bg-section-label">Effects</h3>
          <SliderRow
            label="Blur"
            value={activeTheme.blurAmount}
            min={0}
            max={40}
            suffix="px"
            onChange={(blurAmount) => patch(activeTheme.id, { blurAmount })}
          />
          <SliderRow
            label="Brightness"
            value={activeTheme.brightness}
            min={20}
            max={200}
            suffix="%"
            onChange={(brightness) => patch(activeTheme.id, { brightness })}
          />
          <SliderRow
            label="Opacity"
            value={activeTheme.opacity}
            min={0}
            max={100}
            suffix="%"
            onChange={(opacity) => patch(activeTheme.id, { opacity })}
          />
          <label className="bg-toggle">
            <input
              type="checkbox"
              checked={activeTheme.noiseOverlay}
              onChange={(e) => patch(activeTheme.id, { noiseOverlay: e.target.checked })}
            />
            <span>Film grain</span>
          </label>
        </section>
      )}

      <section className="bg-section">
        <div className="bg-recent-header">
          <h3 className="bg-section-label">Saved backgrounds</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="bg-action-btn" onClick={handleImport} title="Import a theme">
              <Import size={13} /> Import
            </button>
            <button className="bg-action-btn" onClick={handleCreateAndActivate} title="New background">
              <Plus size={13} /> New
            </button>
          </div>
        </div>

        {themes.length > 0 ? (
          <div className="bg-recent-grid">
            {themes.map((theme) => {
              const isActive = settings.activeThemeId === theme.id;
              return (
                <div
                  key={theme.id}
                  className={`bg-recent-card ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTheme(theme.id)}
                >
                  <div className="bg-recent-preview">
                    <BackgroundPreview theme={theme} />
                    {isActive && <span className="bg-active-badge"><Check size={10} /></span>}
                  </div>
                  <div className="bg-recent-info">
                    <span className="bg-recent-name">{theme.name}</span>
                    <span className="bg-recent-type">{theme.backgroundType}</span>
                  </div>
                  <div className="bg-recent-tools">
                    <button
                      className="bg-recent-delete"
                      title="Duplicate"
                      onClick={(e) => { e.stopPropagation(); duplicateTheme(theme.id); }}
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      className="bg-recent-delete danger"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); deleteTheme(theme.id); }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-empty">
            <p>No saved backgrounds</p>
          </div>
        )}
      </section>

      {importError && (
        <div className="bg-toast error" onClick={() => setImportError('')}>{importError}</div>
      )}
    </div>
  );
}

function SliderRow({ label, value, min, max, step = 1, suffix = '', onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="bg-slider-row">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="bg-slider-val">
        {step < 1 ? value.toFixed(2) : Math.round(value)}{suffix}
      </span>
    </div>
  );
}

function ColorRow({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="bg-color-picker-row">
      <label>{label}</label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="bg-hex">{value.toUpperCase()}</span>
    </div>
  );
}

function BackgroundPreview({ theme }: { theme: Theme | undefined }) {
  if (!theme) {
    return (
      <div className="bg-preview-empty-state">
        <Image size={32} />
        <span>No background selected</span>
      </div>
    );
  }
  if (
    (theme.backgroundType === 'video' || theme.backgroundType === 'video-url') &&
    isPlayableVideoUrl(theme.videoUrl)
  ) {
    return (
      <video
        src={theme.videoUrl}
        muted
        loop
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: theme.videoFit === 'fit' ? 'contain' : 'cover'
        }}
      />
    );
  }
  if (theme.backgroundType === 'image' && theme.imageUrl) {
    return <img src={theme.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  if (theme.backgroundType === 'gradient') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: `linear-gradient(${theme.gradientAngle}deg, ${theme.gradientStart}, ${theme.gradientEnd})`
        }}
      />
    );
  }
  return <div style={{ width: '100%', height: '100%', background: theme.solidColor }} />;
}