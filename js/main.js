import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import Lenis from 'https://cdn.jsdelivr.net/npm/lenis@1.3.23/dist/lenis.mjs';

/* ---------- year ---------- */
document.getElementById('copyright').textContent = '© ' + new Date().getFullYear() + ' 4Starventure, Inc. — Built among the stars.';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- reveal ---------- */
(function(){
  const els = document.querySelectorAll('[data-reveal]');
  if (REDUCED){ els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{
      if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold:0.18, rootMargin:'0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
})();

/* ---------- Sticky nav background on scroll ---------- */
const nav = document.querySelector('.nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 16);
addEventListener('scroll', onScroll, { passive:true });
onScroll();

/* ---------- Lenis smooth scroll ---------- */
if (!REDUCED){
  const lenis = new Lenis({ duration:1.15, smoothWheel:true, touchMultiplier:1.5 });
  function raf(t){ lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
}

/* =====================================================================
   WEBGL PLANET SCENE
   ===================================================================== */
const CONFIG = {
  rimColor:'#c1faff', rimPower:2.4, nightLights:10, terrainDepth:0.33, terrainShade:1.3,
  oceanGlint:0.45, oceanDeep:0.12, oceanFlow:3, oceanFlowSpeed:0.8, oceanFlowScale:2.1,
  glowColor:'#3a6cff', glowIntensity:3.35, planetRadius:1.95, spin:0.03, initRotation:2.07,
  tilt:0.37, autoRotate:0,
  cloud1Height:1.005, cloud1Opacity:0.6, cloud1Spin:0.06,
  cloud2Height:1.03, cloud2Opacity:0.5, cloud2Spin:0.14,
  cloud3Height:1.075, cloud3Opacity:0.5, cloud3Spin:0.1,
  bgColor:'#040a1e', flameColor:'#3a6cff', flameColor2:'#c1faff', flameAmt:0.15,
  atmoColor:'#9fc4ff', atmoCount:320, atmoSize:22, atmoSpeed:0.8,
  starColor:'#cfe0ff', starCount:1400, starSize:1.6, starFlicker:1,
  markerColor:'#ffd27a', markerCount:60, markerSize:16, markerSpeed:0.5,
};
const LAYERS = { NONE:0, TORUS_SCENE:1, BLOOM_SCENE:2, ENTIRE_SCENE:3 };

const ASSET_BASE_URL = 'https://api.getlayers.ai/storage/v1/object/public/public/assets/ascend-d9857ad1f2';
const PLANET_GLB = ASSET_BASE_URL + '/planet.glb';
const PLANET_LIGHTS_GLB = ASSET_BASE_URL + '/planet-lights.glb';
const PLANET_CLOUDS_PNG = ASSET_BASE_URL + '/planet-clouds.png';

/* helpers */
const Lerp = (a,b,t)=>a+(b-a)*t;
const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const hexToVec3 = (hex)=>{ const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };
function sample(stops, p){
  if (p <= stops[0].p) return stops[0].v;
  if (p >= stops[stops.length-1].p) return stops[stops.length-1].v;
  for (let i=0;i<stops.length-1;i++){
    const a = stops[i], b = stops[i+1];
    if (p >= a.p && p <= b.p){
      let t = (p - a.p) / (b.p - a.p);
      t = t*t*(3-2*t);
      return Lerp(a.v, b.v, t);
    }
  }
  return stops[stops.length-1].v;
}

/* shared simplex noise */
const SNOISE = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const canvas = document.querySelector('.planet-canvas');
let W = window.innerWidth, H = window.innerHeight;

const renderer = new THREE.WebGL1Renderer({ canvas, antialias:false, powerPreference:'high-performance' });
// cap DPR at 1.75 — beyond that the fullscreen post pass costs 30%+ more fill for no visible gain
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(W, H);
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(40, W/H, 0.1, 200);
camera.position.set(0,0,8);
camera.layers.enable(LAYERS.ENTIRE_SCENE);
scene.add(camera);

const ambient = new THREE.AmbientLight(0xffffff, 1.8);
ambient.layers.set(LAYERS.ENTIRE_SCENE);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(0,10,2);
dir.layers.set(LAYERS.ENTIRE_SCENE);
scene.add(dir);

/* FinalPass shader */
const finalUniforms = {
  iTime:{value:0}, tDiffuse:{value:null},
  uBg:{value:hexToVec3(CONFIG.bgColor)}, uFlameA:{value:hexToVec3(CONFIG.flameColor)},
  uFlameB:{value:hexToVec3(CONFIG.flameColor2)}, uFlameAmt:{value:CONFIG.flameAmt},
};
const finalComposite = new THREE.ShaderMaterial({
  uniforms: finalUniforms,
  depthWrite:false, depthTest:false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float iTime; uniform sampler2D tDiffuse;
    uniform vec3 uBg; uniform vec3 uFlameA; uniform vec3 uFlameB; uniform float uFlameAmt;
    varying vec2 vUv;
    vec3 warp3d(vec3 pos, float t){ float curv=.8,a=1.9,b=0.7; pos*=2.;
      pos.x+=curv*sin(t+a*pos.y)+t*b; pos.y+=curv*cos(t+a*pos.x);
      pos.y+=curv*sin(t+a*pos.z)+t*b; pos.z+=curv*cos(t+a*pos.y);
      pos.z+=curv*sin(t+a*pos.x)+t*b; pos.x+=curv*cos(t+a*pos.z);
      return 0.5+0.5*cos(pos.xyz+vec3(1,2,4)); }
    void main(){
      vec2 uv = 2.*vUv - 1.;
      vec3 w = pow(warp3d(vec3(uv.x, sin(uv.y), uv.y), iTime*1.5), vec3(1.5));
      vec3 flame = 1.5*uFlameA*w.x; flame*=w.y; flame += uFlameB*w.z;
      flame *= smoothstep(0.25, 1., abs(uv.y));
      float md = smoothstep(-0.7, 1., -uv.y*uv.x); flame *= md*md;
      vec3 bg = uBg * (1.0 - 0.4 * length(uv));
      gl_FragColor = vec4(bg + flame*uFlameAmt + texture2D(tDiffuse, vUv).xyz, 1.);
    }`,
});

/* Perf: the old pipeline rendered the scene three times per frame through three
   EffectComposers — two of them targeted layers with no objects and only added black.
   Now: one scene render into a render target, then a single fullscreen composite. */
const rtScene = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
function syncRenderTargetSize(){
  const pr = renderer.getPixelRatio();
  rtScene.setSize(Math.max(2, Math.floor(W * pr)), Math.max(2, Math.floor(H * pr)));
}
syncRenderTargetSize();
finalUniforms.tDiffuse.value = rtScene.texture;

const postScene = new THREE.Scene();
const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finalComposite);
postQuad.frustumCulled = false;
postScene.add(postQuad);
const postCamera = new THREE.Camera();

/* scroll storytelling stops */
const STOPS_X = [{p:0,v:0},{p:0.32,v:-3.1},{p:0.64,v:3.2},{p:1,v:0}];
const STOPS_Y = [{p:0,v:-4.5},{p:0.32,v:0.55},{p:0.64,v:0.45},{p:1,v:0.15}];
const STOPS_S = [{p:0,v:2.15},{p:0.32,v:1.0},{p:0.64,v:0.92},{p:1,v:1.12}];

/* scene hierarchy */
const worldGroup = new THREE.Group();
worldGroup.position.set(STOPS_X[0].v, STOPS_Y[0].v, 0);
worldGroup.scale.setScalar(STOPS_S[0].v);
scene.add(worldGroup);

const planetGroup = new THREE.Group();
planetGroup.rotation.z = CONFIG.tilt;
worldGroup.add(planetGroup);

const cloudGroup = new THREE.Group();
cloudGroup.rotation.z = CONFIG.tilt;
cloudGroup.visible = false;
worldGroup.add(cloudGroup);

/* atmosphere halo glow */
const glowMat = new THREE.ShaderMaterial({
  transparent:true, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms: { uGlow:{value:hexToVec3(CONFIG.glowColor)}, uIntensity:{value:CONFIG.glowIntensity} },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 uGlow; uniform float uIntensity; varying vec2 vUv;
    void main(){
      float d = length(vUv - 0.5) * 2.0;
      float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
      gl_FragColor = vec4(uGlow * a * uIntensity, a);
    }`,
});
const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), glowMat);
glowMesh.scale.setScalar(CONFIG.planetRadius * 2.3);
glowMesh.layers.set(LAYERS.ENTIRE_SCENE);
worldGroup.add(glowMesh);

/* shared time uniforms */
let planetTime = 0, cloudTime = 0, starTime = 0, markerTime = 0;
const planetTimeU = { value: 0 };
const cloudTimeU = { value: 0 };

/* loaders */
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);
const texLoader = new THREE.TextureLoader();
texLoader.crossOrigin = 'anonymous';

let planetMesh = null;
let planetLoaded = false;
let entryStartTime = null;
const ENTRY_DUR = 1.9, ENTRY_START_Y = -6.5;

/* ---------- planet material injection ---------- */
function applyPlanetShader(mat, nightTex){
  mat.metalness = 0; mat.roughness = 1; mat.envMapIntensity = 0;
  mat.onBeforeCompile = (shader)=>{
    shader.uniforms.time = planetTimeU;
    shader.uniforms.noiseScale = { value: 30 };
    shader.uniforms.speedX = { value: 1.5 };
    shader.uniforms.speedY = { value: 2.0 };
    shader.uniforms.speedZ = { value: 2.5 };
    shader.uniforms.rimColor = { value: hexToVec3(CONFIG.rimColor) };
    shader.uniforms.rimPower = { value: CONFIG.rimPower };
    shader.uniforms.nightBlendTexture = { value: nightTex };
    shader.uniforms.nightLights = { value: CONFIG.nightLights };
    shader.uniforms.terrainDepth = { value: CONFIG.terrainDepth };
    shader.uniforms.terrainShade = { value: CONFIG.terrainShade };
    shader.uniforms.oceanGlint = { value: CONFIG.oceanGlint };
    shader.uniforms.oceanDeep = { value: CONFIG.oceanDeep };
    shader.uniforms.oceanFlow = { value: CONFIG.oceanFlow };
    shader.uniforms.oceanFlowSpeed = { value: CONFIG.oceanFlowSpeed };
    shader.uniforms.oceanFlowScale = { value: CONFIG.oceanFlowScale };

    shader.vertexShader = 'varying vec2 vCustomUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('void main() {', 'void main() {\n  vCustomUv = uv;');
    // handle alternate brace spacing
    if (shader.vertexShader.indexOf('vCustomUv = uv;') === -1){
      shader.vertexShader = shader.vertexShader.replace('void main(){', 'void main(){\n  vCustomUv = uv;');
    }

    const fragPrelude = `
      uniform float time; uniform float noiseScale; uniform float speedX; uniform float speedY; uniform float speedZ;
      uniform vec3 rimColor; uniform float rimPower;
      uniform sampler2D nightBlendTexture; uniform float nightLights;
      uniform float terrainDepth; uniform float terrainShade;
      uniform float oceanGlint; uniform float oceanDeep; uniform float oceanFlow; uniform float oceanFlowSpeed; uniform float oceanFlowScale;
      varying vec2 vCustomUv;
      ${SNOISE}
    `;
    shader.fragmentShader = fragPrelude + '\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
      #include <dithering_fragment>
      vec3 normalizedNormal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float rim = 1.0 - max(dot(viewDir, normalizedNormal), 0.0);
      rim = pow(rim, rimPower); rim = pow(rim, 1.5); rim *= 0.7;
      vec3 currentColor = gl_FragColor.rgb;
      float blueDom = currentColor.b - max(currentColor.r, currentColor.g);
      float waterMask = clamp(smoothstep(-0.005, 0.03, blueDom), 0.0, 1.0);
      float shimmer = snoise(vec3(vCustomUv.x * noiseScale + time * speedX, vCustomUv.y * noiseScale - time * speedY, time * speedZ));
      gl_FragColor.rgb += waterMask * shimmer * 0.025;
      float fT = time * oceanFlowSpeed * 4.0;
      float fS = 4.0 * oceanFlowScale;
      float warp = snoise(vec3(vCustomUv.x * fS - fT * 0.5, vCustomUv.y * fS + fT * 0.4, fT * 0.5));
      float flow = snoise(vec3(vCustomUv.x * fS * 2.0 + fT * 0.6 + warp, vCustomUv.y * fS * 2.0 - fT * 0.5, fT * 0.7));
      flow = warp * 0.6 + flow * 0.4;
      gl_FragColor.rgb += waterMask * flow * 0.12 * oceanFlow;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.01, 0.06, 0.16), waterMask * oceanDeep);
      vec3 finalColor = mix(gl_FragColor.rgb, rimColor, rim);
      gl_FragColor = vec4(finalColor, 1.0);
      vec3 surfPos = -vViewPosition;
      float terrH = dot(texture2D(map, vCustomUv).rgb, vec3(0.299, 0.587, 0.114));
      vec3 sigX = dFdx(surfPos), sigY = dFdy(surfPos);
      vec3 vR1 = cross(sigY, normalizedNormal), vR2 = cross(normalizedNormal, sigX);
      float fDet = dot(sigX, vR1);
      vec3 vGrad = sign(fDet) * (dFdx(terrH) * vR1 + dFdy(terrH) * vR2);
      vec3 bumpedNormal = normalize(abs(fDet) * normalizedNormal - terrainDepth * vGrad);
      vec3 shadeNormal = mix(bumpedNormal, normalizedNormal, waterMask);
      vec3 cityLights = texture2D(nightBlendTexture, vCustomUv).rgb * gl_FragColor.rgb * nightLights;
      vec3 viewSunDir = normalize(vec3(-0.9, 0.18, 0.4));
      float ndl = dot(normalizedNormal, viewSunDir);
      float dayAmt = smoothstep(-0.05, 0.35, ndl);
      float relief = dot(shadeNormal, viewSunDir) - ndl;
      gl_FragColor.rgb *= clamp(1.0 + relief * terrainShade * dayAmt, 0.55, 1.6);
      float nightFactor  = smoothstep(0.18, -0.30, ndl);
      float lightsFactor = smoothstep(0.30, -0.35, ndl);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.08, nightFactor);
      gl_FragColor.rgb += cityLights * lightsFactor;
      vec3 halfDir = normalize(viewSunDir + viewDir);
      float ripple = snoise(vec3(vCustomUv * 240.0, time * 4.0));
      float ndh = max(dot(normalizedNormal, halfDir) + ripple * 0.02, 0.0);
      float glint = pow(ndh, 140.0);
      gl_FragColor.rgb += glint * waterMask * dayAmt * oceanGlint * vec3(1.0, 0.97, 0.88);
    `);
  };
  mat.needsUpdate = true;
}

/* ---------- clouds ---------- */
function buildClouds(){
  const tex = texLoader.load(PLANET_CLOUDS_PNG);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5,5);
  const layers = [
    { h:CONFIG.cloud1Height, o:CONFIG.cloud1Opacity, s:CONFIG.cloud1Spin, ry:0.0, phase:0.0 },
    { h:CONFIG.cloud2Height, o:CONFIG.cloud2Opacity, s:CONFIG.cloud2Spin, ry:2.2, phase:13.0 },
    { h:CONFIG.cloud3Height, o:CONFIG.cloud3Opacity, s:CONFIG.cloud3Spin, ry:4.3, phase:27.0 },
  ];
  const cloudMeshes = [];
  const spinKeys = [CONFIG.cloud1Spin, CONFIG.cloud2Spin, CONFIG.cloud3Spin];
  layers.forEach((layer, idx)=>{
    const geo = new THREE.SphereGeometry(CONFIG.planetRadius * layer.h, 64, 64);
    const mat = new THREE.MeshStandardMaterial({ map:tex, transparent:true, depthWrite:false });
    mat.onBeforeCompile = (shader)=>{
      shader.uniforms.uTime = cloudTimeU;
      shader.uniforms.noiseScale = { value: 20 };
      shader.uniforms.uSpeedX = { value: 1 };
      shader.uniforms.uSpeedY = { value: 2 };
      shader.uniforms.uSpeedZ = { value: 2 };
      shader.uniforms.uOpacity = { value: layer.o };
      shader.uniforms.uPhase = { value: layer.phase };
      shader.vertexShader = 'varying vec2 vCloudUv;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('void main() {', 'void main() {\n  vCloudUv = uv;');
      if (shader.vertexShader.indexOf('vCloudUv = uv;') === -1){
        shader.vertexShader = shader.vertexShader.replace('void main(){', 'void main(){\n  vCloudUv = uv;');
      }
      const prelude = `
        uniform float uTime; uniform float noiseScale; uniform float uSpeedX; uniform float uSpeedY; uniform float uSpeedZ;
        uniform float uOpacity; uniform float uPhase;
        varying vec2 vCloudUv;
        ${SNOISE}
      `;
      shader.fragmentShader = prelude + '\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
        #include <dithering_fragment>
        gl_FragColor.rgb = vec3(1.0);
        float cloudNoise = snoise(vec3(vCloudUv.x * noiseScale + uTime * uSpeedX + uPhase, vCloudUv.y * noiseScale - uTime * uSpeedY + uPhase, uTime * uSpeedZ + uPhase));
        float cloudNdv = max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0);
        float cloudEdge = pow(1.0 - cloudNdv, 3.0);
        float cloudMod = mix(cloudNoise, 1.0, cloudEdge);
        float cloudNdl = dot(normalize(vNormal), normalize(vec3(-0.9, 0.18, 0.4)));
        float cloudDay = 1.0 - smoothstep(0.30, -0.30, cloudNdl) * 0.9;
        gl_FragColor.a *= cloudMod * uOpacity * cloudDay;
      `);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = layer.ry;
    mesh.renderOrder = 2;
    mesh.layers.set(LAYERS.ENTIRE_SCENE);
    mesh.userData.spin = layer.s;
    cloudGroup.add(mesh);
    cloudMeshes.push(mesh);
  });
  return cloudMeshes;
}

/* ---------- ambient motes ---------- */
function buildMotes(){
  const count = CONFIG.atmoCount;
  const positions = new Float32Array(count*3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  for (let i=0;i<count;i++){
    positions[i*3]   = Math.random()*2-1;
    positions[i*3+1] = Math.random()*2-1;
    positions[i*3+2] = Math.random()*2-1;
    sizes[i] = CONFIG.atmoSize * (0.4 + Math.random());
    seeds[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes,1));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds,1));
  const mat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending,
    uniforms:{ uTime:{value:0}, uRes:{value:new THREE.Vector2(W,H)}, uColor:{value:hexToVec3(CONFIG.atmoColor)} },
    vertexShader:`
      attribute float size; attribute float seed; uniform float uTime; uniform vec2 uRes;
      varying float vA;
      vec3 warp(vec3 p, float t){ float c=0.9,a=1.9,b=0.02,s=0.05; p*=2.;
        p.x+=c*sin(s*t+a*p.y)+t*b; p.y+=c*cos(s*t+a*p.x); p.y+=c*sin(s*t+a*p.z)+t*b;
        p.z+=c*cos(s*t+a*p.y); p.z+=c*sin(s*t+a*p.x)+t*b; p.x+=c*cos(s*t+a*p.z);
        return cos(p+vec3(1,2,4)); }
      void main(){
        vec3 v = position*4.0 + warp(position, uTime)*1.2;
        vec4 mv = modelViewMatrix * vec4(v, 1.0);
        float r = length(v); float farF = 1.0 - smoothstep(5.0, 6.5, r); float nearF = smoothstep(0.0, 0.5, -mv.z);
        vA = farF * nearF;
        gl_PointSize = size * uRes.y / 900.0 / -mv.z; gl_PointSize = max(gl_PointSize, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader:`
      uniform vec3 uColor; varying float vA;
      void main(){ vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
        float tex = smoothstep(0.5, 0.0, l); gl_FragColor = vec4(uColor * tex, tex * vA * 0.55); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.layers.set(LAYERS.ENTIRE_SCENE);
  points.onBeforeRender = ()=>{
    mat.uniforms.uTime.value = performance.now()/1000 * CONFIG.atmoSpeed * 8;
    points.position.copy(camera.position);
  };
  scene.add(points);
  return { points, mat };
}

/* ---------- starfield ---------- */
function buildStars(){
  const count = CONFIG.starCount;
  const positions = new Float32Array(count*3);
  const seeds = new Float32Array(count);
  const brights = new Float32Array(count);
  for (let i=0;i<count;i++){
    const u = Math.random(), v = Math.random();
    const theta = 2*Math.PI*u, phi = Math.acos(2*v-1);
    const r = 90;
    positions[i*3]   = r*Math.sin(phi)*Math.cos(theta);
    positions[i*3+1] = r*Math.sin(phi)*Math.sin(theta);
    positions[i*3+2] = r*Math.cos(phi);
    seeds[i] = Math.random()*Math.PI*2;
    brights[i] = 0.35 + Math.random()*0.65;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds,1));
  geo.setAttribute('bright', new THREE.BufferAttribute(brights,1));
  const mat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, depthTest:true, blending:THREE.AdditiveBlending,
    uniforms:{ uTime:{value:0}, uSize:{value:CONFIG.starSize}, uFlicker:{value:CONFIG.starFlicker}, uColor:{value:hexToVec3(CONFIG.starColor)}, uRes:{value:new THREE.Vector2(W,H)} },
    vertexShader:`
      attribute float seed; attribute float bright;
      uniform float uTime; uniform float uSize; uniform float uFlicker; uniform vec2 uRes;
      varying float vTw;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.6 + 0.4 * sin(uTime * uFlicker + seed);
        vTw = bright * tw;
        gl_PointSize = max(uSize * uRes.y / 900.0 * (90.0 / max(-mv.z, 1.0)), 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader:`
      uniform vec3 uColor; varying float vTw;
      void main(){
        vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
        float core = smoothstep(0.5, 0.0, l);
        gl_FragColor = vec4(uColor, core * vTw);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.layers.set(LAYERS.ENTIRE_SCENE);
  scene.add(points);
  return { points, mat };
}

/* ---------- land markers ---------- */
function buildMarkers(mesh){
  const geom = mesh.geometry;
  const posAttr = geom.attributes.position;
  const uvAttr = geom.attributes.uv;
  let index = geom.index;
  const triCount = index ? index.count/3 : posAttr.count/3;

  // read base color texture into a downscaled canvas — we only need land/ocean per sample,
  // not full-res pixels (was: whole texture copied into an ImageData)
  const baseTex = mesh.material.map;
  if (!baseTex || !baseTex.image){ return null; }
  const img = baseTex.image;
  const dscale = Math.min(1, 1024 / img.width);
  const cvs = document.createElement('canvas');
  cvs.width = Math.max(1, Math.round(img.width * dscale));
  cvs.height = Math.max(1, Math.round(img.height * dscale));
  const ctx = cvs.getContext('2d', { willReadFrequently:true });
  ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
  const cw = cvs.width, ch = cvs.height;
  let data;
  try { data = ctx.getImageData(0,0,cw,ch).data; }
  catch(e){ return null; }

  // triangle areas for area-weighted sampling
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const cum = new Float32Array(triCount);
  let total = 0;
  const getIdx = (t, c)=> index ? index.getX(t*3+c) : (t*3+c);
  for (let t=0;t<triCount;t++){
    const ia=getIdx(t,0), ib=getIdx(t,1), ic=getIdx(t,2);
    vA.fromBufferAttribute(posAttr, ia);
    vB.fromBufferAttribute(posAttr, ib);
    vC.fromBufferAttribute(posAttr, ic);
    const ab = vB.clone().sub(vA), ac = vC.clone().sub(vA);
    const area = ab.cross(ac).length()*0.5;
    total += area;
    cum[t] = total;
  }

  const positions = [];
  const seeds = [];
  const uvA = new THREE.Vector2(), uvB = new THREE.Vector2(), uvC = new THREE.Vector2();
  let attempts = 0;
  const maxAttempts = CONFIG.markerCount * 200;
  while (positions.length/3 < CONFIG.markerCount && attempts < maxAttempts){
    attempts++;
    const r = Math.random()*total;
    // binary search
    let lo=0, hi=triCount-1;
    while (lo<hi){ const mid=(lo+hi)>>1; if (cum[mid] < r) lo=mid+1; else hi=mid; }
    const t = lo;
    let u = Math.random(), v = Math.random();
    if (u+v > 1){ u = 1-u; v = 1-v; }
    const w = 1-u-v;
    const ia=getIdx(t,0), ib=getIdx(t,1), ic=getIdx(t,2);
    uvA.fromBufferAttribute(uvAttr, ia);
    uvB.fromBufferAttribute(uvAttr, ib);
    uvC.fromBufferAttribute(uvAttr, ic);
    const su = uvA.x*w + uvB.x*u + uvC.x*v;
    const sv = uvA.y*w + uvB.y*u + uvC.y*v;
    // sample pixel
    let px = Math.floor(su * cw) % cw; if (px<0) px+=cw;
    let py = Math.floor((1-sv) * ch) % ch; if (py<0) py+=ch;
    const pi = (py*cw + px)*4;
    const cr = data[pi], cg = data[pi+1], cb = data[pi+2];
    if (cb > cr+6 && cb > cg+6) continue; // ocean, reject
    vA.fromBufferAttribute(posAttr, ia);
    vB.fromBufferAttribute(posAttr, ib);
    vC.fromBufferAttribute(posAttr, ic);
    const wp = new THREE.Vector3(
      vA.x*w + vB.x*u + vC.x*v,
      vA.y*w + vB.y*u + vC.y*v,
      vA.z*w + vB.z*u + vC.z*v
    );
    wp.multiplyScalar(1.012);
    positions.push(wp.x, wp.y, wp.z);
    seeds.push(Math.random());
  }
  if (positions.length === 0) return null;

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions),3));
  g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(seeds),1));
  const mat = new THREE.ShaderMaterial({
    transparent:true, depthTest:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uTime:{value:0}, uColor:{value:hexToVec3(CONFIG.markerColor)}, uSize:{value:CONFIG.markerSize}, uSpeed:{value:CONFIG.markerSpeed}, uRes:{value:new THREE.Vector2(W,H)} },
    vertexShader:`
      attribute float seed; uniform float uSize; uniform vec2 uRes;
      varying float vSeed; varying float vFade;
      void main(){
        vSeed = seed;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 vn = normalize(normalMatrix * normalize(position));
        vec3 vd = normalize(-mv.xyz);
        vFade = smoothstep(0.15, 0.5, dot(vn, vd));
        gl_PointSize = max(uSize * uRes.y / 900.0 * (7.0 / max(-mv.z, 1.0)), 2.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader:`
      uniform vec3 uColor; uniform float uTime; uniform float uSpeed;
      varying float vSeed; varying float vFade;
      void main(){
        if (vFade <= 0.001) discard;
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p) * 2.0;
        if (d > 1.0) discard;
        float core = smoothstep(0.30, 0.0, d) * 1.2;
        float ph = fract(uTime * uSpeed + vSeed);
        float ring = smoothstep(0.07, 0.0, abs(d - ph)) * (1.0 - ph);
        gl_FragColor = vec4(uColor, clamp(core + ring, 0.0, 1.0) * vFade);
      }`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.layers.set(LAYERS.ENTIRE_SCENE);
  mesh.add(points);
  return { points, mat };
}

/* ---------- build everything ---------- */
const motes = buildMotes();
const stars = buildStars();
const cloudMeshes = buildClouds();
let markers = null;

// Perf: fetch both GLBs in parallel (was: lights first, planet only after it parsed)
const loadGltf = (url)=> new Promise((res, rej)=> gltfLoader.load(url, res, undefined, rej));
Promise.all([
  loadGltf(PLANET_LIGHTS_GLB).then((lightsGltf)=>{
    let nightTex = null;
    lightsGltf.scene.traverse(o=>{ if (o.isMesh && !nightTex){ nightTex = o.material.map; } });
    return nightTex;
  }).catch(()=>null),
  loadGltf(PLANET_GLB),
])
.then(([nightTex, gltf])=>{
  let mesh = null;
  gltf.scene.traverse(o=>{ if (o.isMesh && !mesh) mesh = o; });
  if (!mesh) return;
  mesh.geometry.computeBoundingSphere();
  const r0 = mesh.geometry.boundingSphere.radius;
  const s = CONFIG.planetRadius / r0;
  mesh.scale.setScalar(s);

  const mat = mesh.material.clone();
  mesh.material = mat;
  applyPlanetShader(mat, nightTex);
  mesh.layers.set(LAYERS.ENTIRE_SCENE);

  planetGroup.add(mesh);
  planetMesh = mesh;
  planetLoaded = true;
  cloudGroup.visible = true;
  entryStartTime = performance.now()/1000;

  // markers depend on base texture being decoded
  const startMarkers = ()=>{ markers = buildMarkers(mesh); };
  if (mat.map && mat.map.image && mat.map.image.width){ startMarkers(); }
  else if (mat.map){ const im = mat.map.image; if (im){ im.onload = startMarkers; setTimeout(startMarkers, 400); } else setTimeout(startMarkers, 400); }
})
.catch(err=>console.warn('Planet assets failed to load:', err));

/* ---------- scroll-driven choreography state ---------- */
let curP = 0, curX = STOPS_X[0].v, curY = STOPS_Y[0].v, curS = STOPS_S[0].v;
let spinPhase = 0;

/* ---------- animation loop ---------- */
let last = performance.now()/1000;
function animate(){
  requestAnimationFrame(animate);
  const now = performance.now()/1000;
  let dt = now - last; last = now;
  dt = Math.min(dt, 0.05);

  // scroll progress
  const denom = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const pTarget = clamp(window.scrollY / denom, 0, 1);
  curP += (pTarget - curP) * Math.min(1, dt*4.5);

  const sideScale = clamp(window.innerWidth/1200, 0.5, 1);
  const targetX = sample(STOPS_X, curP) * sideScale;
  const targetY = sample(STOPS_Y, curP);
  const targetS = sample(STOPS_S, curP);
  const k = Math.min(1, dt*3.2);
  curX += (targetX - curX) * k;
  curY += (targetY - curY) * k;
  curS += (targetS - curS) * k;

  // one-time float-up entrance
  let entryY = 0;
  if (planetLoaded && !REDUCED && entryStartTime !== null){
    const et = clamp((now - entryStartTime)/ENTRY_DUR, 0, 1);
    const eased = 1 - Math.pow(1 - et, 3);
    entryY = Lerp(ENTRY_START_Y, 0, eased);
  }

  worldGroup.position.set(curX, curY + entryY, 0);
  worldGroup.scale.setScalar(curS);

  // planet turn
  spinPhase += dt * CONFIG.spin;
  planetGroup.rotation.y = CONFIG.initRotation + spinPhase + curP * Math.PI * 1.6;

  // time advances
  planetTime += dt/12; planetTimeU.value = planetTime;
  cloudTime += dt/20; cloudTimeU.value = cloudTime;
  starTime += dt; stars.mat.uniforms.uTime.value = starTime;
  markerTime += dt; if (markers) markers.mat.uniforms.uTime.value = markerTime;
  finalUniforms.iTime.value = now;

  // cloud spin
  cloudMeshes.forEach(m=>{ m.rotation.y += dt * m.userData.spin; });

  // halo billboard
  glowMesh.quaternion.copy(camera.quaternion);

  // render: single scene pass into RT, then one fullscreen composite to screen
  renderer.setRenderTarget(rtScene);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCamera);
}
animate();

/* ---------- resize ---------- */
function onResize(){
  W = window.innerWidth; H = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pr); renderer.setSize(W,H);
  camera.aspect = W/H; camera.updateProjectionMatrix();
  syncRenderTargetSize();
  motes.mat.uniforms.uRes.value.set(W,H);
  stars.mat.uniforms.uRes.value.set(W,H);
  if (markers) markers.mat.uniforms.uRes.value.set(W,H);
}
window.addEventListener('resize', onResize);
