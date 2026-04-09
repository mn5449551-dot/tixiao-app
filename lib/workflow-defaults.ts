import { getAvailableChannels, getAvailableImageForms } from "@/lib/constants";

export function getDefaultDirectionGenerationInput(targetAudience: string) {
  const channels = getAvailableChannels(targetAudience);
  const channel =
    channels.find((item) => getAvailableImageForms(item).length > 1) ??
    channels[0] ??
    "信息流（广点通）";
  const imageForms = getAvailableImageForms(channel);

  return {
    channel,
    imageForm: imageForms.find((item) => item !== "single") ?? imageForms[0] ?? "single",
  };
}

export function resolveImageStyleForMode(styleMode: string, imageStyle: string) {
  if (styleMode === "ip") {
    return "animation";
  }

  return imageStyle;
}

export function shouldShowImageStyleField(styleMode: string) {
  return styleMode !== "ip";
}

export function shouldShowIpAssetSelector(styleMode: string, useIp: boolean) {
  void useIp;
  return styleMode === "ip";
}
