// scripts/render-sprites-tieu-tien.mjs
// Tự động render 20 sprite isometric + bóng + icon + manifest.json từ mô hình 3D (Playwright + Three.js + Sharp)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import esbuild from 'esbuild';

const PROJECT_DIR = process.cwd();
const OUTPUT_DIR = path.join(PROJECT_DIR, 'public/tieu-tien/sprites');
const VAT_PHAM_PATH = path.join(PROJECT_DIR, 'src/explore/tieu-tien/data/vat-pham.json');

// Đảm bảo thư mục đích tồn tại
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Bundle models3d.ts sang ESM in-memory cho browser
console.log('Bundling models3d.ts...');
const bundleResult = await esbuild.build({
  entryPoints: [path.join(PROJECT_DIR, 'src/explore/tieu-tien/models3d.ts')],
  bundle: true,
  format: 'esm',
  external: ['three'],
  write: false,
});
const models3dCode = bundleResult.outputFiles[0].text;

// Đọc danh sách 20 vật phẩm
const vatPhamData = JSON.parse(fs.readFileSync(VAT_PHAM_PATH, 'utf8'));
const items = vatPhamData.vatPham;

// 2. Tạo HTTP Server phục vụ Three.js và GLB
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: transparent; overflow: hidden; }
    canvas { display: block; }
  </style>
  <script type="importmap">
  {
    "imports": {
      "three": "/node_modules/three/build/three.module.js",
      "three/examples/jsm/loaders/GLTFLoader.js": "/node_modules/three/examples/jsm/loaders/GLTFLoader.js"
    }
  }
  </script>
</head>
<body>
  <canvas id="stage"></canvas>
  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

    window.THREE = THREE;
    window.GLTFLoader = GLTFLoader;

    // Nạp bundle models3d
    const blob = new Blob([window.__MODELS3D_CODE], { type: 'application/javascript' });
    const moduleUrl = URL.createObjectURL(blob);
    import(moduleUrl).then((mod) => {
      window.MODELS3D = mod;
      window.__READY = true;
    });
  </script>
</body>
</html>`);
    return;
  }

  // URL alias cho model
  let reqPath = url;
  if (reqPath.startsWith('/tieu-tien/models/')) {
    reqPath = '/public' + reqPath;
  }

  const filePath = path.join(PROJECT_DIR, reqPath);
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    let mime = 'application/octet-stream';
    if (ext === '.js' || ext === '.mjs') mime = 'application/javascript';
    else if (ext === '.json') mime = 'application/json';
    else if (ext === '.glb') mime = 'model/gltf-binary';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(fs.readFileSync(filePath));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Chạy render
server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Render server listening on http://localhost:${port}`);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 2048, height: 2048 });

  // Đưa mã bundle vào trang trước khi tải
  await page.addInitScript(`window.__MODELS3D_CODE = ${JSON.stringify(models3dCode)};`);
  await page.goto(`http://localhost:${port}`);
  await page.waitForFunction(() => window.__READY);
  console.log('Playwright & Three.js ready. Initializing scene renderer...');

  // Khởi tạo renderer và scene trong browser
  await page.evaluate(() => {
    const THREE = window.THREE;
    const canvas = document.getElementById('stage');
    const width = 2048;
    const height = 2048;
    canvas.width = width;
    canvas.height = height;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();

    // Camera Isometric cố định
    // SCALE: 36 px trên mỗi đơn vị thế giới
    const SCALE = 36;
    const halfW = width / (2 * SCALE);
    const halfH = height / (2 * SCALE);
    const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -500, 500);
    const dist = 120;
    camera.position.set(dist, dist, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    // Ánh sáng môi trường mềm
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdcd8cf, 0.95);
    scene.add(hemiLight);

    // Nguồn sáng chính đổ bóng
    const dirLight = new THREE.DirectionalLight(0xfffaee, 1.45);
    dirLight.position.set(45, 80, 35);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 250;
    dirLight.shadow.bias = -0.0002;
    dirLight.shadow.radius = 3;
    scene.add(dirLight);

    // Ánh sáng viền (rim light) nhẹ nhàng từ góc đối diện tạo khối sắc nét
    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.65);
    rimLight.position.set(-45, 35, -45);
    scene.add(rimLight);

    // Mặt đất hứng bóng mềm
    const shadowGeo = new THREE.PlaneGeometry(120, 120);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Lưu vào window để render từng item
    window.__ctx = {
      renderer,
      scene,
      camera,
      shadowPlane,
      gltfLoader: new window.GLTFLoader(),
      width,
      height,
    };
  });

  const manifest = {};
  let totalBytes = 0;

  function getItemScale(itemId) {
    // Sprite nhỏ: phở, trà đá, xe máy, ô tô, iPhone… (~50–120px) -> ×2.5
    const smallItems = [
      'tra-da',
      'pho',
      've-phim',
      'hoc-phi-thang',
      'luong-toi-thieu',
      'honda-vision',
      'iphone',
      'vf3',
      'vf8',
      'vf9',
    ];
    if (smallItems.includes(itemId)) {
      return 2.5;
    }
    return 2.0;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemScale = getItemScale(item.id);
    console.log(`[${i + 1}/${items.length}] Rendering ${item.id} (${item.ten}) at scale ×${itemScale}...`);

    const renderResult = await page.evaluate(async ({ itemId, itemScale }) => {
      const { renderer, scene, camera, shadowPlane, gltfLoader, width, height } = window.__ctx;
      const THREE = window.THREE;
      const { ITEM_3D_CONFIG, createProceduralMesh, createMetroTrainGroup, createBulletTrainGroup } = window.MODELS3D;

      const BASE_SCALE = 36;
      const currentScale = BASE_SCALE * itemScale;
      const halfW = width / (2 * currentScale);
      const halfH = height / (2 * currentScale);
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();

      const cfg = ITEM_3D_CONFIG[itemId] || { spacing: 2.0, scale: 1.0 };
      let model = null;

      if (cfg.modelUrl) {
        try {
          const gltf = await gltfLoader.loadAsync(cfg.modelUrl);
          const baseModel = gltf.scene;
          if (itemId === 'metro-1') {
            model = createMetroTrainGroup(baseModel, THREE);
          } else if (itemId === 'dstdc') {
            model = createBulletTrainGroup(baseModel, THREE);
          } else {
            model = baseModel;
          }
        } catch (e) {
          console.error('Lỗi khi tải GLB:', cfg.modelUrl, e);
        }
      }

      if (!model) {
        model = createProceduralMesh(itemId, THREE);
      }

      model.scale.setScalar(cfg.scale);

      // Căn giữa hình học:
      // Tính bounding box chính xác để đưa tâm khối về (0, 0, 0) và đáy chạm Y = 0
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.x = -center.x;
      model.position.z = -center.z;
      model.position.y = -box.min.y;

      // Cấu hình đổ bóng và vật liệu
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          if (child.material) {
            child.material.roughness = Math.max(child.material.roughness ?? 0.4, 0.3);
          }
        }
      });

      scene.add(model);

      // --- Pass 1: Render Sprite (nền trong suốt) ---
      shadowPlane.visible = false;
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);
      const spriteData = renderer.domElement.toDataURL('image/png');

      // --- Pass 2: Render Bóng (mặt đất) ---
      shadowPlane.visible = true;
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.colorWrite = false;
        }
      });
      renderer.render(scene, camera);
      const shadowData = renderer.domElement.toDataURL('image/png');

      // Bounding box kích thước thế giới
      const size = box.getSize(new THREE.Vector3());

      // Dọn dẹp model khỏi scene
      scene.remove(model);

      return {
        spriteData,
        shadowData,
        sizeW: size.x,
        sizeD: size.z,
        sizeH: size.y,
        footprintW: cfg.spacing,
        footprintD: cfg.spacing,
      };
    }, { itemId: item.id, itemScale });

    // Chuyển base64 sang Buffer
    const spriteBuf = Buffer.from(renderResult.spriteData.replace(/^data:image\/png;base64,/, ''), 'base64');
    const shadowBuf = Buffer.from(renderResult.shadowData.replace(/^data:image\/png;base64,/, ''), 'base64');

    const C_X = 1024;
    const C_Y = 1024;

    // 1. Cắt sát sprite và xuất WebP
    const spriteTrim = await sharp(spriteBuf).trim().toBuffer({ resolveWithObject: true });
    const spriteW = spriteTrim.info.width;
    const spriteH = spriteTrim.info.height;
    const anchorX = Math.round(C_X + spriteTrim.info.trimOffsetLeft);
    const anchorY = Math.round(C_Y + spriteTrim.info.trimOffsetTop);

    const spriteWebpBuf = await sharp(spriteTrim.data)
      .webp({ quality: 85, effort: 6 })
      .toBuffer();
    const spritePath = path.join(OUTPUT_DIR, `${item.id}.webp`);
    fs.writeFileSync(spritePath, spriteWebpBuf);
    totalBytes += spriteWebpBuf.length;

    // 2. Cắt sát bóng mờ và làm mềm bóng
    let shadowW = 0, shadowH = 0, shadowAnchorX = 0, shadowAnchorY = 0;

    // Kiểm tra xem shadowBuf có điểm ảnh đổ bóng hợp lệ không
    const rawShadow = await sharp(shadowBuf).raw().toBuffer({ resolveWithObject: true });
    let nonZeroShadow = 0;
    for (let p = 3; p < rawShadow.data.length; p += 4) {
      if (rawShadow.data[p] > 8) nonZeroShadow++;
    }

    if (nonZeroShadow > 30) {
      const shadowTrim = await sharp(shadowBuf).trim().toBuffer({ resolveWithObject: true });
      shadowW = shadowTrim.info.width;
      shadowH = shadowTrim.info.height;
      shadowAnchorX = Math.round(C_X + shadowTrim.info.trimOffsetLeft);
      shadowAnchorY = Math.round(C_Y + shadowTrim.info.trimOffsetTop);

      const shadowWebpBuf = await sharp(shadowTrim.data)
        .blur(Math.max(1.5, 1.5 * (itemScale / 1.5)))
        .webp({ quality: 85, effort: 6 })
        .toBuffer();
      fs.writeFileSync(path.join(OUTPUT_DIR, `${item.id}-shadow.webp`), shadowWebpBuf);
      totalBytes += shadowWebpBuf.length;
    } else {
      // Bóng tiếp xúc mềm (contact shadow) cho các vật thể mỏng/nhỏ nằm sát sàn
      const sw = Math.max(30, Math.round(spriteW * 0.9));
      const sh = Math.max(16, Math.round(sw * 0.5));
      const svgShadow = `<svg width="${sw}" height="${sh}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#000" stop-opacity="0.35"/>
            <stop offset="60%" stop-color="#000" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="${sw / 2}" cy="${sh / 2}" rx="${sw / 2}" ry="${sh / 2}" fill="url(#g)"/>
      </svg>`;

      const shadowWebpBuf = await sharp(Buffer.from(svgShadow)).webp({ quality: 85 }).toBuffer();
      shadowW = sw;
      shadowH = sh;
      shadowAnchorX = Math.round(sw / 2);
      shadowAnchorY = Math.round(sh / 2);
      fs.writeFileSync(path.join(OUTPUT_DIR, `${item.id}-shadow.webp`), shadowWebpBuf);
      totalBytes += shadowWebpBuf.length;
    }

    // 3. Xuất icon 96×96 cho panel mua sắm
    // Thu nhỏ tỉ lệ cân đối vào khung 84×84 và căn giữa trong khung 96×96
    const iconInner = await sharp(spriteTrim.data)
      .resize(84, 84, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    const iconWebpBuf = await sharp({
      create: {
        width: 96,
        height: 96,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: iconInner.data, gravity: 'center' }])
      .webp({ quality: 85, effort: 5 })
      .toBuffer();

    const iconPath = path.join(OUTPUT_DIR, `${item.id}-icon.webp`);
    fs.writeFileSync(iconPath, iconWebpBuf);
    totalBytes += iconWebpBuf.length;

    // Lưu vào manifest
    manifest[item.id] = {
      w: spriteW,
      h: spriteH,
      anchorX,
      anchorY,
      footprintW: renderResult.footprintW,
      footprintD: renderResult.footprintD,
      shadowW,
      shadowH,
      shadowAnchorX,
      shadowAnchorY,
      scale: itemScale,
    };
  }

  // Ghi file manifest.json
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n--- KẾT QUẢ RENDER SPRITE ---');
  console.log(`Đã render 20 vật phẩm (${items.length * 3} files WebP + manifest.json)`);
  console.log(`Tổng dung lượng ảnh: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (mục tiêu <= 3 MB)`);
  console.log(`Manifest: ${manifestPath}`);

  await browser.close();
  server.close();
  process.exit(0);
});
