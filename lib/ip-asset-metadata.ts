export const IP_ASSET_METADATA = {
  豆包: {
    role: "豆包",
    description: "篮球少年 · 阳光活力型",
    promptKeywords:
      'male middle school student, dark spiky hair, cheerful wide grin, white basketball jersey with "ONION 11" orange v-neck trim, gray shorts, gray jacket draped over left shoulder, sports wristband on left wrist, energetic pose, anime illustration style',
  },
  小锤: {
    role: "小锤",
    description: "创客少年 · 动手实干型",
    promptKeywords:
      "male middle school student, dark bowl-cut hair with one ahoge strand, green short-sleeve t-shirt over black long-sleeve shirt, white collar visible, gray shorts with dark belt, hammer and lightning badge on chest, hand on hip, confident smile, anime illustration style",
  },
  豆花: {
    role: "豆花",
    description: "元气少女 · 可爱亲和型",
    promptKeywords:
      "female middle school student, brown short bob hair, red hairband, red eyes, white long-sleeve undershirt, orange peach short-sleeve top, red bow tie at collar, orange pleated skirt, pointing gesture with right hand, cute cheerful expression, anime illustration style",
  },
  雷婷: {
    role: "雷婷",
    description: "班长学霸 · 理性可靠型",
    promptKeywords:
      "female middle school student, long black twin tails with blue ribbon ties, round glasses, white long-sleeve shirt, blue school vest with emblem, blue pleated skirt, red-blue striped bow tie, red armband on left arm, holding thick black notebook labeled NOTE, hand on hip, calm confident smile, anime illustration style",
  },
  狗蛋: {
    role: "狗蛋",
    description: "佛系大哥 · 稳重反差型",
    promptKeywords:
      "male middle school student, bald shaved head, calm slight smile, blue hoodie with yellow stripe on shoulders, blue and yellow logo patch on chest, white drawstrings, white pants with black side stripe, relaxed casual pose, anime illustration style",
  },
  上官: {
    role: "上官",
    description: "学院酷男 · 思考智慧型",
    promptKeywords:
      "male middle school student, brown messy spiky hair, earphone in ear with white cord, white long-sleeve shirt, blue school vest with badge pin, red-blue diagonal striped tie, dark pants, one hand in pocket, other hand near chin in thinking pose, slight cool smile, anime illustration style",
  },
} as const;

export function getIpAssetThumbnailUrl(role: string) {
  return `/api/ip-assets/${encodeURIComponent(role)}`;
}

export const IP_ASSET_OPTIONS = Object.values(IP_ASSET_METADATA).map((item) => ({
  ...item,
  thumbnailUrl: getIpAssetThumbnailUrl(item.role),
}));
