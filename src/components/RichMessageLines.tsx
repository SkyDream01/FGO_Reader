import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { imageUrl } from "../data/atlas";
import type { Region } from "../types";
import type { MessageLineView, MessageSpanView } from "../adv/message";
import type { PreparedCustomPackage } from "../lib/storyPreparation";
import { useCustomAssetUrl } from "../hooks/useCustomAssetUrl";

function InlineImage({ image, region, customPackage }: { image: NonNullable<MessageSpanView["image"]>; region: Region; customPackage?: PreparedCustomPackage | null }) {
  const [failed, setFailed] = useState(false);
  const { url, usingLocalAsset, useFallback } = useCustomAssetUrl({ packageId: customPackage?.id, assetPath: customPackage?.assets.images?.[image.name], preloadedUrl: customPackage?.assetUrls.images?.[image.name], fallbackUrl: imageUrl(region, image.name) });
  useEffect(() => setFailed(false), [url]);
  return failed ? <span>{image.alt || "□"}</span> : <img className={image.icon ? "message-icon" : "message-image"} src={url} alt={image.alt} style={image.scale === undefined ? undefined : { height: `${(image.icon ? 1.2 : 1.8) * image.scale}em` }} onError={() => usingLocalAsset ? useFallback() : setFailed(true)} />;
}
export function RichMessageLines({ lines, region = "JP", customPackage }: { lines: MessageLineView[]; region?: Region; customPackage?: PreparedCustomPackage | null }) {
  return <>{lines.map((line, index) => <Fragment key={index}>
    {index > 0 && <br />}
    <span className="message-line" style={{ textAlign: line.align }}>{line.spans.map((span, n) => {
      const style: CSSProperties = { color: span.color ?? undefined, fontSize: span.fontSize ? `${span.fontSize / 29}em` : undefined, verticalAlign: span.verticalAlign === "center" ? "middle" : span.verticalAlign, textEmphasis: span.emphasis ? "filled dot" : undefined };
      if (span.image) return <InlineImage key={n} image={span.image} region={region} customPackage={customPackage} />;
      return span.ruby ? <ruby key={n} style={style}>{span.text}<rt>{span.ruby}</rt></ruby> : <span key={n} style={style}>{span.text}</span>;
    })}</span>
  </Fragment>)}</>;
}
