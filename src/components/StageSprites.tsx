import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { backgroundUrl, imageUrl, characterUrl, characterTextureUrl, getCharacterFigureMetadata, getEquipmentGraphUrl } from "../data/atlas";
import { useCustomAssetUrl } from "../hooks/useCustomAssetUrl";
import type { CharacterView, StageLayerView } from "../adv/executor";
import type { PreparedCustomPackage } from "../lib/storyPreparation";
import type { StoryLaunch } from "../types";
import { stageCoordinateToViewport, stageRatioToViewport } from "../lib/stageCoordinates";
import { resolveCharacterFigurePlacement, resolveCharacterAlphaContentRect, resolveCharacterCenterCorrection, resolveCharacterCanvasSize, resolveCharacterBodyHeight, resolveCharacterFaceRegion, type CharacterCenterCorrection } from "../lib/characterFigure";
import { figureResourceCandidates } from "../adv/resources";
const FIGURE_CANVAS_SIZE = 1024;
const ZERO_CHARACTER_CENTER_CORRECTION: CharacterCenterCorrection = { x: 0, y: 0 };
const defaultCharacterX = { left: -256, center: 0, right: 256 };
const stageLayerAssetId = (layer: StageLayerView) => layer.id;
function loadBrowserImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`立绘资源读取失败：${url}`));
    image.src = url;
  });
}

function resolveImageCharacterCenterCorrection(
  image: HTMLImageElement,
  fit: "contain" | "cover",
) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width <= 0 || height <= 0) return ZERO_CHARACTER_CENTER_CORRECTION;

  const stageSize = FIGURE_CANVAS_SIZE;
  const scale = fit === "cover"
    ? Math.max(stageSize / width, stageSize / height)
    : Math.min(stageSize / width, stageSize / height);
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  const fallback = resolveCharacterCenterCorrection({
    left: (stageSize - renderedWidth) / 2,
    top: stageSize - renderedHeight,
    width: renderedWidth,
    height: resolveCharacterBodyHeight(height, null) * scale,
  }, stageSize);

  try {
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = stageSize;
    scanCanvas.height = stageSize;
    const context = scanCanvas.getContext("2d");
    if (!context) return fallback;

    context.save();
    context.beginPath();
    context.rect(0, 0, stageSize, stageSize * 0.75);
    context.clip();
    context.drawImage(
      image,
      0,
      0,
      width,
      height,
      (stageSize - renderedWidth) / 2,
      stageSize - renderedHeight,
      renderedWidth,
      renderedHeight,
    );
    context.restore();

    const visibleContent = resolveCharacterAlphaContentRect(
      context.getImageData(0, 0, stageSize, stageSize).data,
      stageSize,
      stageSize,
    );
    return visibleContent
      ? resolveCharacterCenterCorrection(visibleContent, stageSize)
      : fallback;
  } catch {
    // A cross-origin image without CORS headers can be drawn but not inspected.
    return fallback;
  }
}

function AtlasCharacterFigure({
  character,
  region,
  mergedUrl,
  onError,
  onOrigin,
}: {
  character: CharacterView;
  region: StoryLaunch["region"];
  mergedUrl: string;
  onError: () => void;
  onOrigin: (y: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [resources, setResources] = useState<{
    merged: HTMLImageElement;
    figureWidth: number;
    figureHeight: number;
    metadata: Awaited<ReturnType<typeof getCharacterFigureMetadata>>;
  } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResources(null);
    setReady(false);

    Promise.all([
      loadBrowserImage(mergedUrl),
      loadBrowserImage(characterTextureUrl(region, character.id)).catch(() => null),
      getCharacterFigureMetadata(region, character.id).catch(() => null),
    ])
      .then(([merged, texture, metadata]) => {
        if (cancelled) return;
        setResources({
          merged,
          figureWidth: texture?.naturalWidth || merged.naturalWidth || FIGURE_CANVAS_SIZE,
          figureHeight: texture?.naturalHeight || FIGURE_CANVAS_SIZE,
          metadata,
        });
      })
      .catch(() => {
        if (!cancelled) onError();
      });

    return () => {
      cancelled = true;
    };
  }, [character.id, mergedUrl, region]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !resources) return;
    const context = canvas.getContext("2d");
    if (!context) {
      onError();
      return;
    }

    const { merged, figureWidth, figureHeight, metadata } = resources;
    const { canvasSize, left: figureLeft, top: figureTop } = resolveCharacterFigurePlacement(figureWidth, figureHeight, metadata);
    onOrigin(figureTop + (FIGURE_CANVAS_SIZE - canvasSize) / 2);
    const bodyHeight = resolveCharacterBodyHeight(figureHeight, metadata);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      merged,
      0,
      0,
      figureWidth,
      bodyHeight,
      figureLeft,
      figureTop,
      figureWidth,
      bodyHeight,
    );

    if (metadata) {
      const face = resolveCharacterFaceRegion(character.face, figureHeight, metadata);
      if (
        face &&
        face.sourceX + face.width <= merged.naturalWidth &&
        face.sourceY + face.height <= merged.naturalHeight
      ) {
        context.drawImage(
          merged,
          face.sourceX,
          face.sourceY,
          face.width,
          face.height,
          figureLeft + metadata.faceX,
          figureTop + metadata.faceY,
          face.width,
          face.height,
        );
      }
    }
    setReady(true);
  }, [character.face, onError, onOrigin, resources]);

  const canvasSize = resources
    ? resolveCharacterCanvasSize(resources.figureWidth, resources.figureHeight)
    : FIGURE_CANVAS_SIZE;

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      className={ready ? "ready" : ""}
      aria-label={character.name}
      style={{ width: `calc(${canvasSize} * var(--adv-unit))`, height: `calc(${canvasSize} * var(--adv-unit))` }}
    />
  );
}

export function StageLayerSprite({
  layer,
  region,
  customPackage,
  fullScreen,
}: {
  layer: StageLayerView;
  region: StoryLaunch["region"];
  customPackage: PreparedCustomPackage | null;
  fullScreen: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const assetId = stageLayerAssetId(layer);
  const fallbackUrl = layer.source === "background" ? backgroundUrl(region, assetId, fullScreen) : imageUrl(region, assetId);
  const {
    url,
    useFallback,
  } = useCustomAssetUrl({
    packageId: customPackage?.id,
    assetPath: layer.source === "background" ? customPackage?.assets.backgrounds[assetId] : customPackage?.assets.images?.[assetId],
    preloadedUrl: layer.source === "background" ? customPackage?.assetUrls.backgrounds[assetId] : customPackage?.assetUrls.images?.[assetId],
    fallbackUrl,
    fallbackUrls: layer.source === "background" && fullScreen ? [backgroundUrl(region, assetId)] : [],
  });
  useEffect(() => {
    setFailed(false);
  }, [url]);
  const style = {
    opacity: layer.alpha,
    zIndex: layer.depth,
    "--stage-layer-x": stageCoordinateToViewport(layer.x, "x"),
    "--stage-layer-y": stageCoordinateToViewport(layer.y, "y"),
    "--stage-layer-scale": String(layer.scale),
    "--stage-layer-depth": String(layer.depth ?? 0),
    "--stage-layer-rotation": `${layer.rotation}deg`,
    "--stage-layer-width": layer.source === "background" && url.endsWith("_1344_626.png") ? "1344" : "1024",
  } as CSSProperties;

  return url && !failed ? (
    <img
      className={`stage-layer-sprite ${layer.layer === "sub" ? "sub" : "main"}`}
      data-scale-type={layer.fullScreenScale}
      data-image-kind={layer.mode}
      data-slot={layer.slot}
      data-source={layer.source}
      data-background-fill={layer.source === "background" && layer.layer !== "sub" && layer.rotation === 0 && layer.scale >= 1 && (!layer.fullScreenScale || layer.fullScreenScale === "0") ? "true" : undefined}
      src={url}
      alt=""
      style={style}
      onError={() => {
        if (!useFallback()) setFailed(true);
      }}
      draggable={false}
    />
  ) : null;
}

function CharacterSpriteFrame({
  character,
  region,
  customPackage,
  characterCalibrationOffset,
  characterDebugOffset,
  showCharacterOrigin,
  spriteMask,
}: {
  character: CharacterView;
  region: StoryLaunch["region"];
  customPackage: PreparedCustomPackage | null;
  characterCalibrationOffset: { x: number; y: number };
  characterDebugOffset: { x: number; y: number };
  showCharacterOrigin: boolean;
  spriteMask?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [equipmentUrl, setEquipmentUrl] = useState<string | null>(null);
  const [equipmentFallback, setEquipmentFallback] = useState(false);
  const [wideAtlas, setWideAtlas] = useState(false);
  const [characterFigureOriginY, setCharacterFigureOriginY] = useState<number | null>(null);
  const [characterCenterCorrection, setCharacterCenterCorrection] = useState<CharacterCenterCorrection>(
    ZERO_CHARACTER_CENTER_CORRECTION,
  );
  const candidates = figureResourceCandidates(character.id), resolvedId = candidates[Math.min(candidateIndex, candidates.length - 1)];
  const fallbackUrl = character.mode === "equip" ? equipmentUrl ?? "" : characterUrl(region, resolvedId);
  useEffect(() => setCandidateIndex(0), [character.id, region]);
  useEffect(() => { setEquipmentFallback(false); }, [character.id, character.mode]);
  useEffect(() => {
    if (character.mode !== "equip") return;
    let active = true; setEquipmentUrl(null);
    void getEquipmentGraphUrl(region, equipmentFallback ? "9400010" : character.id).then(url => {
      if (!active) return;
      if (url) setEquipmentUrl(url);
      else if (!equipmentFallback) setEquipmentFallback(true);
      else setFailed(true);
    });
    return () => { active = false; };
  }, [character.id, character.mode, region, equipmentFallback]);
  const characterX = Number.isFinite(character.x)
    ? character.x
    : defaultCharacterX[character.position];
  const characterY = Number.isFinite(character.y) ? character.y : 0;
  const characterScale = Number.isFinite(character.scale) && character.scale > 0
    ? character.scale
    : 1;
  // Native Scale and Roll are separate nodes: scale from the bitmap's top,
  // while keeping the script's rotation pivot in stage coordinates.
  const figureScaleOffset = characterFigureOriginY === null ? { x: 0, y: 0 } : {
    x: (characterScale - 1) * (character.pivot?.x ?? 0),
    y: (characterScale - 1) * (characterFigureOriginY - FIGURE_CANVAS_SIZE / 2 + (character.pivot?.y ?? 0)),
  };
  const characterStyle = {
    opacity: character.alpha,
    zIndex: character.depth,
    filter: character.dimmed ? "brightness(.55)" : undefined,
    transformOrigin: `calc(50% + ${stageCoordinateToViewport(character.pivot?.x ?? 0, "x")}) calc(50% + ${stageCoordinateToViewport(character.pivot?.y ?? 0, "y")})`,
    clipPath: character.cut ? cutClip(character.cut.name, character.cut.progress, character.cut.level) : undefined,
    maskImage: spriteMask && character.maskInteraction !== "none" ? character.maskInteraction === "outside" ? "radial-gradient(ellipse closest-side, transparent 65%, #000 100%)" : `url("${customPackage?.assetUrls.images?.[`mask_${spriteMask}`] ?? new URL("../adv/assets/soft-mask.svg", import.meta.url).href}")` : undefined,
    maskSize: "100% 100%",
    "--character-x": stageCoordinateToViewport(characterX, "x"),
    "--character-y": stageCoordinateToViewport(characterY, "y"),
    "--character-calibration-x": stageRatioToViewport(
      characterCalibrationOffset.x,
      "x",
      "character",
    ),
    "--character-calibration-y": stageRatioToViewport(
      characterCalibrationOffset.y,
      "y",
      "character",
    ),
    "--character-debug-x": stageRatioToViewport(
      characterDebugOffset.x,
      "x",
      "character",
    ),
    "--character-debug-y": stageRatioToViewport(
      characterDebugOffset.y,
      "y",
      "character",
    ),
    "--character-visual-correction-x": stageCoordinateToViewport(characterCenterCorrection.x * characterScale * FIGURE_CANVAS_SIZE + figureScaleOffset.x, "x"),
    "--character-visual-correction-y": stageCoordinateToViewport(characterCenterCorrection.y * characterScale * FIGURE_CANVAS_SIZE + figureScaleOffset.y, "y"),
    "--character-scale": String(characterScale),
    "--character-rotation": `${character.rotation ?? 0}deg`,
    "--character-axis-x": String(character.rollAxis?.x ?? 0),
    "--character-axis-y": String(character.rollAxis?.y ?? 0),
    "--character-axis-z": String(character.rollAxis?.z ?? 1),
  } as CSSProperties;
  const characterOriginStyle = {
    "--character-x": stageCoordinateToViewport(characterX, "x"),
    "--character-y": stageCoordinateToViewport(characterY, "y"),
    "--character-calibration-x": stageRatioToViewport(
      characterCalibrationOffset.x,
      "x",
      "character",
    ),
    "--character-calibration-y": stageRatioToViewport(
      characterCalibrationOffset.y,
      "y",
      "character",
    ),
    "--character-debug-x": stageRatioToViewport(
      characterDebugOffset.x,
      "x",
      "character",
    ),
    "--character-debug-y": stageRatioToViewport(
      characterDebugOffset.y,
      "y",
      "character",
    ),
  } as CSSProperties;
  const {
    url,
    usingLocalAsset,
    useFallback,
  } = useCustomAssetUrl({
    packageId: customPackage?.id,
    assetPath: character.mode === "equip" ? customPackage?.assets.images?.[`CharaGraph/${character.id}`] ?? customPackage?.assets.characters[character.id] : customPackage?.assets?.characters?.[character.id],
    preloadedUrl: character.mode === "equip" ? customPackage?.assetUrls.images?.[`CharaGraph/${character.id}`] ?? customPackage?.assetUrls.characters[character.id] : customPackage?.assetUrls.characters[character.id],
    fallbackUrl,
  });

  useEffect(() => {
    setFailed(false);
    setWideAtlas(false);
    setCharacterFigureOriginY(null);
    setCharacterCenterCorrection(ZERO_CHARACTER_CENTER_CORRECTION);
  }, [url]);

  const handleFigureOrigin = useCallback((y: number) => setCharacterFigureOriginY(y), []);

  const handleAtlasError = useCallback(() => {
    if (candidateIndex + 1 < candidates.length) setCandidateIndex(candidateIndex + 1);
    else setFailed(true);
  }, [candidateIndex, candidates.length]);

  return (
    <>
      <div
        className={`character-sprite ${character.active ? "active" : "inactive"} ${character.silhouette ? "silhouette" : ""} ${character.shadow ? "with-shadow" : ""} ${usingLocalAsset && wideAtlas ? "wide-atlas" : ""}`}
        data-position={character.position}
        data-slot={character.slot}
        style={characterStyle}
      >
        {!failed && url && (usingLocalAsset || character.mode === "equip") ? (
          <img
            src={url}
            alt={character.name}
            onLoad={(event) => {
              const image = event.currentTarget;
              const wide = image.naturalWidth / image.naturalHeight > 1.25;
              setWideAtlas(wide);
              setCharacterCenterCorrection(
                resolveImageCharacterCenterCorrection(image, wide ? "cover" : "contain"),
              );
            }}
            onError={() => {
              if (usingLocalAsset) {
                useFallback();
                return;
              }
              if (character.mode === "equip" && !equipmentFallback) setEquipmentFallback(true);
              else setFailed(true);
            }}
            draggable={false}
          />
        ) : !failed && url ? (
          <AtlasCharacterFigure
          character={{ ...character, id: resolvedId }}
          region={region}
          mergedUrl={url}
          onError={handleAtlasError}
          onOrigin={handleFigureOrigin}
        />
        ) : failed ? (
          <div className="character-fallback" aria-label={`${character.name} 立绘不可用`}>
            <span>{character.name.slice(0, 1)}</span>
            <small>{character.name}</small>
          </div>
        ) : null}
        {character.silhouette && character.color && <div className="adv-silhouette-tint" style={{ backgroundColor: character.color, maskImage: `url("${url}")`, maskSize: "contain", maskPosition: "center", maskRepeat: "no-repeat" }} />}
      </div>
      {showCharacterOrigin && (
        <span
          className="coordinate-origin-debug character-origin-debug"
          style={characterOriginStyle}
          aria-hidden="true"
        >
          <i />
          <small>角色 0,0</small>
        </span>
      )}
    </>
  );
}

function cutClip(name: string, progress: number, level: number): string {
  const amount = Math.max(0, Math.min(1, progress * (1 + level / 255))) * 100;
  if (/circle/i.test(name)) return `circle(${amount}% at 50% 50%)`;
  if (/upToDown/i.test(name)) return `inset(0 0 ${100 - amount}% 0)`;
  if (/downToUp/i.test(name)) return `inset(${100 - amount}% 0 0 0)`;
  if (/rightToLeft/i.test(name)) return `inset(0 0 0 ${100 - amount}%)`;
  return `inset(0 ${100 - amount}% 0 0)`;
}

/** Two real figure buffers preserve the old face/id during a crossfade. */
export function CharacterSprite(props: Parameters<typeof CharacterSpriteFrame>[0]) {
  const { character } = props, change = character.change;
  return <>
    {change && <CharacterSpriteFrame {...props} showCharacterOrigin={false} character={{ ...character, id: change.id, face: change.face, change: null, alpha: character.alpha * (1 - change.progress) }} />}
    <CharacterSpriteFrame {...props} character={{ ...character, alpha: character.alpha * (change?.progress ?? 1) }} />
  </>;
}

