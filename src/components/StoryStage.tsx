import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import type { StageSnapshot, CharacterView, StageLayerView } from "../adv/executor";
import type { SubLayerState, TransformState } from "../adv/stage";
import { backgroundUrl, imageUrl, pictureFrameUrl } from "../data/atlas";
import type { Region } from "../types";
import type { PreparedCustomPackage } from "../lib/storyPreparation";
import type { CoordinateDebugSettings } from "../lib/coordinateDebug";
import { STAGE_WIDTH, stageCoordinateToViewport } from "../lib/stageCoordinates";
import { blurFilterCss } from "../lib/blurFilter";
import { useCustomAssetUrl } from "../hooks/useCustomAssetUrl";
import { CharacterSprite, StageLayerSprite } from "./StageSprites";
import { RuntimeEffects, CommunicationWindow, InsertionAnimations } from "./RuntimeEffects";

const zero = { x: 0, y: 0 };
const filters = (...values: string[]) => values.filter((value) => value !== "none").join(" ") || "none";
const transform = (state: TransformState & { scaleX?: number; scaleY?: number }) => `translate(${stageCoordinateToViewport(state.x, "x")}, ${stageCoordinateToViewport(state.y, "y")}) scale(${state.scale * (state.scaleX ?? 1)},${state.scale * (state.scaleY ?? 1)}) rotate(${state.rotation}deg)`;
const pivotOrigin = (pivot?: { x: number; y: number }) => pivot ? `calc(50% + ${stageCoordinateToViewport(pivot.x, "x")}) calc(50% + ${stageCoordinateToViewport(pivot.y, "y")})` : undefined;
export function cameraFilterCss(value: string | null): string {
  return (value ?? "").split("&").map((part) => ({ gray: "grayscale(1)", inversion: "invert(1)", darkred: "sepia(0.72) saturate(1.7) hue-rotate(300deg) brightness(0.72)" }[part] ?? "")).filter(Boolean).join(" ") || "none";
}
function blurCss(intensity: number | null, kind: string): string {
  return intensity === null ? "none" : kind.startsWith("MotionBlur") ? `blur(${intensity * 0.4}px) url(#adv-motion-blur)` : kind.startsWith("FrostedGlass") ? `blur(${intensity}px) contrast(1.08)` : blurFilterCss(intensity);
}

function PreviousBackground({ id, region, customPackage, opacity, fullScreen }: { id: string; region: Region; customPackage: PreparedCustomPackage | null; opacity: number; fullScreen: boolean }) {
  const { url, useFallback } = useCustomAssetUrl({ packageId: customPackage?.id, assetPath: customPackage?.assets.backgrounds[id], preloadedUrl: customPackage?.assetUrls.backgrounds[id], fallbackUrl: backgroundUrl(region, id, fullScreen), fallbackUrls: fullScreen ? [backgroundUrl(region, id)] : [] });
  return <img className="scene-image scene-image-previous" src={url} alt="" style={{ opacity }} onError={() => { useFallback(); }} draggable={false} />;
}
function FrameImage({ name, region, top, customPackage, fullScreen }: { name: string; region: Region; top: boolean; customPackage: PreparedCustomPackage | null; fullScreen: boolean }) {
  const [failed, setFailed] = useState(false);
  const { url, useFallback } = useCustomAssetUrl({ packageId: customPackage?.id, assetPath: customPackage?.assets.images?.[name], preloadedUrl: customPackage?.assetUrls.images?.[name], fallbackUrl: pictureFrameUrl(region, name, fullScreen), fallbackUrls: fullScreen && name === "cut063_cinema" ? [pictureFrameUrl(region, name)] : [] });
  useEffect(() => setFailed(false), [url]);
  return failed ? null : <img className={`adv-picture-frame ${top ? "top" : ""} ${name === "cut063_cinema" ? "cinematic" : ""}`} data-fullscreen={url.includes("/cut063_cinema_fs/")} src={url} alt="" onError={() => { if (!useFallback()) setFailed(true); }} draggable={false} />;
}
function SubSurface({ layer, region, children }: { layer: SubLayerState; region: Region; children: ReactNode }) {
  const edgeFilterId = `sub-edge-${useId().replace(/:/g, "")}`;
  const [maskAsset, setMaskAsset] = useState<{ key: string; url: string | null; failed: boolean }>({ key: "", url: null, failed: false });
  const maskKey = `${region}:${layer.mask ?? ""}`;
  const needsMask = Boolean(layer.mask && !layer.mask.startsWith("#"));
  const maskUrl = maskAsset.key === maskKey ? maskAsset.url : null;
  const maskFailed = maskAsset.key === maskKey && maskAsset.failed;
  const maskLoading = needsMask && !maskUrl && !maskFailed;
  const edgeMask = layer.camera.filter === "maskEdge";
  useEffect(() => {
    if (!layer.mask || layer.mask.startsWith("#")) return;
    let active = true;
    const image = new Image(), url = imageUrl(region, layer.mask);
    image.onload = () => { if (active) setMaskAsset({ key: maskKey, url, failed: false }); };
    image.onerror = () => { if (active) setMaskAsset({ key: maskKey, url: null, failed: true }); };
    image.src = url;
    return () => { active = false; image.onload = null; image.onerror = null; };
  }, [layer.mask, region, maskKey]);
  const style: CSSProperties = {
    transform: transform({ ...layer, x: layer.x + layer.shakeX, y: layer.y + layer.shakeY }),
    opacity: layer.visible && !maskLoading ? layer.alpha : 0,
    zIndex: 100 + layer.depth,
    filter: filters(blurCss(layer.blur, layer.blurKind), edgeMask && layer.maskEdge?.width ? `url(#${edgeFilterId})` : "none"),
  };
  const maskStyle: CSSProperties = {
    maskImage: maskUrl ? `url("${maskUrl}")` : undefined,
    maskMode: edgeMask ? "luminance" : "alpha",
    maskPosition: "center", maskSize: edgeMask ? "100% 100%" : "cover", maskRepeat: "no-repeat",
  };
  return <>
    {edgeMask && layer.maskEdge && <svg className="adv-filter-defs" aria-hidden="true"><defs>
      <filter id={edgeFilterId} x="-10%" y="-10%" width="120%" height="120%" primitiveUnits="objectBoundingBox">
        <feMorphology in="SourceAlpha" operator="dilate" radius={layer.maskEdge.width / (2 * STAGE_WIDTH)} result="edge" />
        <feFlood floodColor={layer.maskEdge.color} />
        <feComposite in2="edge" operator="in" />
        <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs></svg>}
    <div className={`adv-sub-layer${edgeMask ? " adv-sub-layer-masked" : ""}`} data-group={layer.key} data-mask={layer.mask ?? undefined} data-mask-state={!needsMask ? "none" : maskUrl ? "ready" : maskFailed ? "failed" : "loading"} style={style}>
      <div className="adv-camera-root adv-sub-mask" style={maskStyle}>
        <div className="adv-camera-root" style={{ transform: transform(layer.stretch) }}><div className="adv-camera-root" style={{ transform: layer.cameraEnabled ? transform(layer.camera) : undefined, transformOrigin: pivotOrigin(layer.camera.pivot), filter: cameraFilterCss(layer.camera.filter) }}>{children}</div></div>
      </div>
    </div>
  </>;
}

function wipeClip(wipe: StageSnapshot["wipe"]): string {
  const progress = Math.min(1, Math.max(0, wipe.progress * (1 + Math.max(0, wipe.level) / 255)));
  const amount = (wipe.kind === "in" ? progress : 1 - progress) * 100;
  if (/circle|Eye/i.test(wipe.name)) return `circle(${100 - amount}% at 50% 50%)`;
  const incoming = wipe.kind === "in";
  // The named direction is the sweep's movement, for both covering (out) and
  // revealing (in). Revealing clears the opposite side of the remaining mask.
  if (/downToUp/i.test(wipe.name)) return incoming ? `inset(0 0 ${amount}% 0)` : `inset(${amount}% 0 0 0)`;
  if (/upToDown/i.test(wipe.name)) return incoming ? `inset(${amount}% 0 0 0)` : `inset(0 0 ${amount}% 0)`;
  if (/rightToLeft/i.test(wipe.name)) return incoming ? `inset(0 ${amount}% 0 0)` : `inset(0 0 0 ${amount}%)`;
  if (/leftToRight/i.test(wipe.name)) return incoming ? `inset(0 0 0 ${amount}%)` : `inset(0 ${amount}% 0 0)`;
  if (/Up|Down/i.test(wipe.name)) return `inset(${amount}% 0 0 0)`;
  return `inset(0 ${amount}% 0 0)`;
}

export function StoryStage({ snapshot, region, customPackage, currentBackground, onBackgroundError, debug }: {
  snapshot: StageSnapshot; region: Region; customPackage: PreparedCustomPackage | null;
  currentBackground: string; onBackgroundError: () => void; debug: CoordinateDebugSettings;
}) {
  const filterId = useId().replace(/:/g, ""), distortion = snapshot.presentation.distortion;
  const sprites: Array<CharacterView | StageLayerView> = [...snapshot.characters, ...snapshot.stageLayers].sort((left, right) => left.depth - right.depth || left.slot.localeCompare(right.slot));
  const render = (sprite: CharacterView | StageLayerView) => "source" in sprite
    ? <StageLayerSprite key={sprite.slot} layer={sprite} region={region} customPackage={customPackage} fullScreen={snapshot.fullScreen} />
    : <CharacterSprite key={sprite.slot} character={sprite} region={region} customPackage={customPackage} spriteMask={snapshot.presentation.spriteMask} characterCalibrationOffset={zero} characterDebugOffset={debug.characterOrigin} showCharacterOrigin={debug.showCharacterOrigin} />;
  const debugStyle = { transform: `translate(${stageCoordinateToViewport(debug.screenOrigin.x * 1024, "x")}, ${stageCoordinateToViewport(debug.screenOrigin.y * 576, "y")})` };
  const frozen = snapshot.presentation.capture;
  const frozenSnapshot: StageSnapshot | null = frozen ? { ...snapshot, characters: frozen.slots.filter(slot => slot.visible && slot.kind === "figure").map(slot => ({ ...slot, active: false })), stageLayers: frozen.slots.filter(slot => slot.visible && slot.kind !== "figure").map(slot => ({ ...slot, source: slot.kind === "background" ? "background" : "image" })), subLayers: frozen.subLayers, background: { ...snapshot.background, id: frozen.background, previousId: null, crossfade: 1 }, camera: frozen.camera, blur: frozen.blur, pictureFrame: null, fade: frozen.fade, mask: frozen.mask, wipe: frozen.wipe, flash: frozen.flash, presentation: { ...snapshot.presentation, capture: null, effects: frozen.effects, communication: frozen.communication, stretch: frozen.stretch, insertions: [] } } : null;
  return <>
    <svg className="adv-filter-defs" aria-hidden="true"><defs>
      <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency={`${Math.max(0.001, Math.abs(distortion.range) * 0.01)} .015`} numOctaves="2" seed="8" /><feDisplacementMap in="SourceGraphic" scale={distortion.strength * Math.max(1, distortion.coefficient)} xChannelSelector="R" yChannelSelector="G" /></filter>
      <filter id="adv-motion-blur"><feGaussianBlur stdDeviation="6 0.5" /></filter>
    </defs></svg>
    <div className="adv-composition" aria-hidden="true" style={{ transform: `translate(${stageCoordinateToViewport(snapshot.shake.x, "x")}, ${stageCoordinateToViewport(snapshot.shake.y, "y")})` }}>
      <div className="adv-camera-root" style={{ transform: transform(snapshot.presentation.stretch) }}>
      <div className="world-layer" style={{ transform: transform(snapshot.camera), transformOrigin: pivotOrigin(snapshot.camera.pivot), filter: filters(cameraFilterCss(snapshot.camera.filter), blurCss(snapshot.blur, snapshot.presentation.blurKind), distortion.enabled ? `url(#${filterId})` : "none") }}>
        <div className="scene-layer">
          {snapshot.background.previousId && snapshot.background.crossfade < 1 && <PreviousBackground id={snapshot.background.previousId} region={region} customPackage={customPackage} opacity={1 - snapshot.background.crossfade} fullScreen={snapshot.fullScreen} />}
          {currentBackground && <img className="scene-image" src={currentBackground} alt="剧情背景" onError={onBackgroundError} draggable={false} data-mode={snapshot.background.mode} />}
          {!currentBackground && <div className="scene-fallback" />}
        </div>
        <div className="adv-camera-root" style={debugStyle}>
          <RuntimeEffects snapshot={snapshot} region={region} customPackage={customPackage} />
          {sprites.filter((sprite) => sprite.layer === "main").map(render)}
          {snapshot.subLayers.slice().sort((a, b) => a.depth - b.depth).map((layer) => <SubSurface key={layer.key} layer={snapshot.presentation.subStretch ? layer : { ...layer, stretch: { x: 0, y: 0, scale: 1, rotation: 0 } }} region={region}><RuntimeEffects snapshot={snapshot} region={region} customPackage={customPackage} scope={layer.key} />{sprites.filter((sprite) => sprite.layer === "sub" && sprite.group === layer.key).map(render)}</SubSurface>)}
          {debug.showScreenOrigin && <span className="coordinate-origin-debug screen-origin-debug"><i /><small>画面 0,0</small></span>}
        </div>
        {snapshot.pictureFrame && !snapshot.pictureFrameTop && <FrameImage name={snapshot.pictureFrame} region={region} top={false} customPackage={customPackage} fullScreen={snapshot.fullScreen} />}
      </div>
      </div>
    </div>
    {frozenSnapshot && <div className="adv-capture"><StoryStage snapshot={frozenSnapshot} region={region} customPackage={customPackage} currentBackground={frozen?.background ? customPackage?.assetUrls.backgrounds[frozen.background] ?? backgroundUrl(region, frozen.background, frozenSnapshot.fullScreen) : ""} onBackgroundError={() => undefined} debug={{ ...debug, showCharacterOrigin: false, showScreenOrigin: false }} /></div>}
    {snapshot.presentation.communication && <CommunicationWindow state={snapshot.presentation.communication} region={region} customPackage={customPackage} />}
    <InsertionAnimations snapshot={snapshot} region={region} customPackage={customPackage} />
    {snapshot.fade.alpha > 0 && <div className="transition-overlay" data-transition="fade" style={{ opacity: snapshot.fade.alpha, backgroundColor: snapshot.fade.color ?? "#000" }} />}
    {snapshot.mask.alpha > 0 && <div className="transition-overlay" data-transition="mask" style={{ opacity: snapshot.mask.alpha, backgroundColor: snapshot.mask.color ?? "#000" }} />}
    {snapshot.wipe.alpha > 0 && <div className="transition-overlay" data-transition="wipe" data-wipe={snapshot.wipe.name} style={{ backgroundColor: snapshot.wipe.color ?? "#000", clipPath: wipeClip(snapshot.wipe) }} />}
    {snapshot.flash.alpha > 0 && <div className="transition-overlay adv-flash" data-transition="flash" style={{ opacity: snapshot.flash.alpha, backgroundColor: snapshot.flash.color ?? "#fff" }} />}
    {snapshot.pictureFrame && snapshot.pictureFrameTop && <FrameImage name={snapshot.pictureFrame} region={region} top customPackage={customPackage} fullScreen={snapshot.fullScreen} />}
  </>;
}
