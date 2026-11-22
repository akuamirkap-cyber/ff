import bounds from "./reefBounds.json";
import floorBounds from "./seabedBounds.json";

type Bounds = { x: number; y: number; w: number; h: number; base?: {x:number;y:number;w:number;h:number} };
const region = bounds as Record<string, Bounds>;
export const hasReefRender=(seed:number)=>!!region[seed]?.base;
const textures = new Map<string, HTMLImageElement>();

export function bakedTexture(name: string) {
  let img = textures.get(name);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = `/images/baked/${name}.webp`;
    textures.set(name, img);
    // Keep only the nearby reefs decoded. The browser's HTTP cache handles return visits.
    if (textures.size > 24) textures.delete(textures.keys().next().value!);
  } else {
    textures.delete(name); textures.set(name, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

export function drawDistant3D(ctx:CanvasRenderingContext2D,cl:number,ct:number,vw:number,vh:number) {
  const a=bakedTexture("far-a"),b=bakedTexture("far-b");
  if (!a || !b) return false;
  const cx=cl+vw/2,cy=ct+vh/2;
  ctx.save();ctx.imageSmoothingEnabled=true;
  for (const [img,par,alpha] of [[a,.2,.59],[b,.45,.78]] as const) {
    const left=par*cx-vw/2,top=par*cy-vh/2;
    const x0=Math.max(0,left),y0=Math.max(0,top),x1=Math.min(3800,left+vw),y1=Math.min(2650,top+vh);
    if(x1<=x0||y1<=y0)continue;
    ctx.globalAlpha=alpha;
    ctx.drawImage(img,x0/3800*img.width,y0/2650*img.height,(x1-x0)/3800*img.width,(y1-y0)/2650*img.height,x0-left,y0-top,x1-x0,y1-y0);
  }
  ctx.restore();return true;
}

const visible = new Set<number>();
const onScreen=(b:Bounds,cl:number,ct:number,w:number,h:number)=>b.x+b.w>=cl-16&&b.y+b.h>=ct-16&&b.x<=cl+w+16&&b.y<=ct+h+16;
export function paintCachedReefs(ctx: CanvasRenderingContext2D, forms: { seed: number }[], cl: number, ct: number, w: number, h: number) {
  visible.clear();
  for(const f of forms){const b=region[f.seed]?.base;if(!b||!onScreen(b,cl,ct,w,h))continue;const img=bakedTexture(`base-${f.seed}`);if(img){ctx.drawImage(img,b.x-cl,b.y-ct,b.w,b.h);visible.add(f.seed);}}
  for (const f of forms) {
    const box = region[f.seed];
    if (!box || box.x + box.w < cl - 20 || box.y + box.h < ct - 20 || box.x > cl + w + 20 || box.y > ct + h + 20) continue;
    const img = bakedTexture(`reef-${f.seed}`);
    if (!img) continue;
    ctx.drawImage(img, box.x - cl, box.y - ct, box.w, box.h);
    visible.add(f.seed);
  }
  return visible;
}

export function drawPrerenderedBed(ctx:CanvasRenderingContext2D,cl:number,ct:number,w:number,h:number){
  const tiles=(floorBounds as Bounds[]).flatMap((b,i)=>onScreen(b,cl,ct,w,h)?[{b,img:bakedTexture(`sand-${i}`)}]:[]);
  if(!tiles.length||tiles.some(t=>!t.img))return false;
  for(const {b,img} of tiles)ctx.drawImage(img!,b.x-cl,b.y-ct,b.w+.05,b.h);
  return true;
}
export function cachedRim(ctx:CanvasRenderingContext2D,f:{seed:number},cl:number,ct:number,w:number,h:number){
  const b=region[f.seed];if(!b?.base ||!onScreen(b,cl,ct,w,h))return false;
  const img=bakedTexture(`rim-${f.seed}`);if(!img)return false;ctx.drawImage(img,b.x-cl,b.y-ct,b.w,b.h);return true;
}

const beams: (HTMLCanvasElement | undefined)[] = [];
export function searchlight(cool = false) {
  const key=Number(cool);if(beams[key])return beams[key]!;
  const beam = document.createElement("canvas"); beam.width = 192; beam.height = 80;
  const c = beam.getContext("2d")!, image = c.createImageData(192, 80);
  for (let x = 0; x < 192; x++) for (let y = 0; y < 80; y++) {
    const u = 1 - x / 191, v = (y - 38 - u * 4) / (2 + u * 22), i = (y * 192 + x) * 4;
    image.data[i] = cool?177:255; image.data[i + 1] = cool?226:222; image.data[i + 2] = cool?251:151;
    image.data[i + 3] = (cool?147:168) * (1 - u) ** 1.42 * Math.exp(-v * v * 1.05);
  }
  c.putImageData(image, 0, 0); beams[key]=beam; return beam;
}