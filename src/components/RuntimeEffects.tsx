import { useEffect, useId, useState, type CSSProperties } from "react";
import type { StageSnapshot } from "../adv/executor";
import type { EffectInstance, CommunicationState, MovieState } from "../adv/stage";
import type { PreparedCustomPackage } from "../lib/storyPreparation";
import type { Region } from "../types";
import { imageUrl } from "../data/atlas";
import { CharacterSprite } from "./StageSprites";
import { useCustomAssetUrl } from "../hooks/useCustomAssetUrl";
import { stageCoordinateToViewport as coord } from "../lib/stageCoordinates";

export const noiseTexture = new URL("../adv/assets/noise.svg", import.meta.url).href;
export const softMaskTexture = new URL("../adv/assets/soft-mask.svg", import.meta.url).href;
const communicationFrame = new URL("../adv/assets/communication-frame.svg", import.meta.url).href;
const slashTexture = new URL("../adv/assets/slash.svg", import.meta.url).href;
const particleTexture = new URL("../adv/assets/particles.svg", import.meta.url).href;
const zero = { x: 0, y: 0 };

export function EffectVisual({ effect }: { effect: EffectInstance }) {
  const id = useId().replace(/:/g, ""), time = effect.elapsed / 2;
  if (effect.status === "paused") return null;
  return <svg className="adv-effect-art" viewBox="0 0 1024 576" aria-hidden="true">
    <defs><radialGradient id={id}><stop stopColor={effect.color} stopOpacity=".5" /><stop offset="1" stopColor={effect.color} stopOpacity="0" /></radialGradient></defs>
    {effect.preset === "slash" ? <image href={slashTexture} width="1024" height="576" opacity={0.7} transform={`rotate(${/h_slash/i.test(effect.name) ? 25 : /v_slash/i.test(effect.name) ? -65 : 0} 512 288)`} />
      : effect.preset === "noise" ? <image href={noiseTexture} width="1024" height="576" preserveAspectRatio="none" opacity=".5" />
      : effect.preset === "rain" ? Array.from({ length: 40 }, (_, i) => { const y = (i * 71 + time * 576) % 680 - 52, x = i * 137 % 1024; return <path key={i} d={`M${x} ${y}l-14 42`} stroke={effect.color} strokeWidth={i % 3 + 1} opacity=".45" />; })
      : effect.preset === "rays" ? Array.from({ length: 28 }, (_, i) => <path key={i} d="m512 288 560-9-160 19Z" fill={effect.color} opacity={0.15 + i % 3 * 0.12} transform={`rotate(${i * 360 / 28 + time * 12} 512 288) scale(${0.75 + effect.progress * 0.25})`} />)
      : effect.preset === "ring" ? <><ellipse cx="512" cy="355" rx={100 + time * 80} ry={30 + time * 16} fill="none" stroke={effect.color} strokeWidth="3" opacity={1 - time * 0.6} /><ellipse cx="512" cy="355" rx="180" ry="60" fill={`url(#${id})`} /><image href={particleTexture} x="256" y={-30 - time * 80} width="512" height="576" /></>
      : effect.preset === "smoke" ? Array.from({ length: 7 }, (_, i) => <ellipse key={i} cx={i * 190 % 1024} cy={410 - Math.sin(time * Math.PI * 2 + i) * 40} rx="260" ry="130" fill={`url(#${id})`} opacity=".4" />)
      : <image href={particleTexture} x="0" y={-time * 60} width="1024" height="620" opacity=".65" />}
  </svg>;
}

function EffectLayer({ effect, snapshot, region, customPackage }: { effect: EffectInstance; snapshot: StageSnapshot; region: Region; customPackage: PreparedCustomPackage | null }) {
  const chara = /^chara:([^:]+):/.exec(effect.container), owner = chara ? snapshot.characters.find(c => c.slot === chara[1]) ?? snapshot.stageLayers.find(c => c.slot === chara[1]) : undefined;
  const name = effect.assetName, path = customPackage?.assets.images?.[name] ?? customPackage?.assets.images?.[effect.name], local = customPackage?.assetUrls.images?.[name] ?? customPackage?.assetUrls.images?.[effect.name];
  const { url } = useCustomAssetUrl({ packageId: customPackage?.id, assetPath: path, preloadedUrl: local, fallbackUrl: "" });
  const [failed, setFailed] = useState(false); useEffect(() => setFailed(false), [url]);
  const style: CSSProperties = { opacity: effect.opacity * (owner?.alpha ?? 1), color: effect.color,
    transform: `translate(${coord(effect.x + (owner?.x ?? 0) + Number(effect.parameters.bodyCenter?.split(",")[0] || 0), "x")},${coord(effect.y + (owner?.y ?? 0) + Number(effect.parameters.bodyCenter?.split(",")[1] || 0), "y")}) scale(${(effect.flip === "H" || effect.flip === "F" ? -1 : 1) * (effect.range || 1)}, ${(effect.flip === "V" || effect.flip === "F" ? -1 : 1) * (effect.range || 1)})`,
    zIndex: effect.container === "backEffect" || effect.container.endsWith(":backEffect") ? -1 : effect.container === "fowardEffect" ? 40 : (owner?.depth ?? 0) + 20 };
  return <div className="adv-runtime-effect" data-effect={effect.name} data-container={effect.container} style={style}>{url && !failed ? <img src={url} alt="" onError={() => setFailed(true)} /> : <EffectVisual effect={effect} />}</div>;
}
export function RuntimeEffects({ snapshot, region, customPackage, scope = "main" }: { snapshot: StageSnapshot; region: Region; customPackage: PreparedCustomPackage | null; scope?: string }) {
  const effects = snapshot.presentation.effects.filter(effect => {
    if (effect.container === "effectmessage") return scope === "message";
    const chara = /^chara:([^:]+):/.exec(effect.container);
    if (!chara) return scope === "main";
    const owner = snapshot.characters.find(c => c.slot === chara[1]) ?? snapshot.stageLayers.find(c => c.slot === chara[1]);
    return owner && scope === (owner.layer === "main" ? "main" : owner.group);
  });
  return <>{effects.map(effect => <EffectLayer key={effect.id} effect={effect} snapshot={snapshot} region={region} customPackage={customPackage} />)}</>;
}

export function CommunicationWindow({ state, region, customPackage }: { state: CommunicationState; region: Region; customPackage: PreparedCustomPackage | null }) {
  return <div className="adv-communication" data-face={state.face} data-svt={state.svtId} data-limit={state.limitCount} style={{ opacity: state.opacity, zIndex: 30 + state.depth / 10, transform: `translate(calc(-50% + ${coord(state.x, "x")}),calc(-50% + ${coord(state.y, "y")}))` }}>
    <img className="adv-communication-frame" src={communicationFrame} alt="" />
    <div className="adv-communication-portrait"><CharacterSprite character={{ slot: "COMM", id: `${state.svtId}${state.limitCount}`, name: "通讯对象", face: state.face, position: "center", x: 0, y: -40, scale: 0.85, rotation: 0, alpha: 1, active: true, silhouette: false, shadow: false, color: null, layer: "main", group: "#A", depth: 0 }} region={region} customPackage={customPackage} characterCalibrationOffset={zero} characterDebugOffset={zero} showCharacterOrigin={false} /></div>
    {state.noiseKind !== 0 && <div className="adv-communication-noise" style={{ backgroundImage: `url("${noiseTexture}")`, backgroundPositionY: `${Math.floor(state.elapsed * 8) * 37}px`, opacity: state.elapsed > 1.8 ? 0.65 : 0.16 }} />}
    <span className="adv-communication-label">通信接続 <i /> CONNECTED</span>
  </div>;
}

export function InsertionAnimations({ snapshot, region, customPackage }: { snapshot: StageSnapshot; region: Region; customPackage: PreparedCustomPackage | null }) {
  return <>{snapshot.presentation.insertions.filter(object => object.phase !== "ready").map(object => {
    const progress = object.phase === "out" ? 1 - object.progress : object.progress;
    return <div key={object.name} className="adv-insertion" data-insertion={object.name} style={{ transform: `translate(${coord(object.x, "x")},${coord(object.y, "y")}) scale(${object.scale})`, opacity: progress, clipPath: `polygon(${100 - progress * 100}% 0,100% 0,100% 100%,0 100%)` }}>
      <svg viewBox="0 0 1024 576" preserveAspectRatio="none"><path fill="#e7f6fd" d="M1024 0 80 576h944Z" /><path fill="#357a9d" d="M1024 68 260 576h764Z" /><path stroke="#b2f1ff" strokeWidth="7" d="M1024 55 230 576" /></svg>
      {object.images.map(name => <img key={name} src={customPackage?.assetUrls.images?.[name] ?? imageUrl(region, name)} alt="" onError={event => { event.currentTarget.style.display = "none"; }} />)}
    </div>;
  })}</>;
}

/** One bounded placeholder clock; an available local mp4/webm takes over using its real lifecycle. */
export function MoviePlayer({ movie, customPackage, onFinish, onProgress }: { movie: MovieState; customPackage: PreparedCustomPackage | null; onFinish: () => void; onProgress: (name: string, elapsed: number, duration: number) => void }) {
  const [failed, setFailed] = useState(false), key = `Movie/${movie.name}`;
  const { url } = useCustomAssetUrl({ packageId: customPackage?.id, assetPath: customPackage?.assets.movies?.[movie.name] ?? customPackage?.assets.movies?.[key], preloadedUrl: customPackage?.assetUrls.movies?.[movie.name] ?? customPackage?.assetUrls.movies?.[key], fallbackUrl: "" });
  useEffect(() => setFailed(false), [url]);
  return <div className={`adv-movie ${movie.blocking ? "blocking" : "background"}`} data-movie={movie.name} onClick={event => event.stopPropagation()}>
    {url && !failed ? <video src={url} autoPlay playsInline controls onEnded={onFinish} onError={() => { setFailed(true); onFinish(); }} onLoadedMetadata={event => { onProgress(movie.name, event.currentTarget.currentTime, event.currentTarget.duration); void event.currentTarget.play().catch(onFinish); }} onTimeUpdate={event => onProgress(movie.name, event.currentTarget.currentTime, event.currentTarget.duration)} /> : <div className="adv-movie-placeholder"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="m34 20 46 30-46 30Z" fill="none" stroke="currentColor" /></svg><span>影片资源未提供</span><small>{movie.name}</small><progress value={movie.elapsed} max={movie.duration} /></div>}
    <button onClick={onFinish} aria-label="跳过影片">跳过影片 ›</button>
  </div>;
}
