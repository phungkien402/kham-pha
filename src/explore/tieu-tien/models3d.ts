// src/explore/tieu-tien/models3d.ts
// Quản lý và khởi tạo hình học 3D (GLB CC0 và Three.js Low-poly Primitives)

import type * as THREE_TYPE from 'three';

export interface Item3DDefinition {
  id: string;
  spacing: number;
  scale: number;
  modelUrl?: string; // File GLB trong /tieu-tien/models/
  isLargeInfrastructure?: boolean; // Công trình lớn chỉ hiện 1 mô hình quy mô lớn
}

export const ITEM_3D_CONFIG: Record<string, Item3DDefinition> = {
  'tra-da': { id: 'tra-da', spacing: 1.6, scale: 4.2, modelUrl: '/tieu-tien/models/tra-da.glb' },
  'pho': { id: 'pho', spacing: 2.0, scale: 2.6, modelUrl: '/tieu-tien/models/pho.glb' },
  've-phim': { id: 've-phim', spacing: 1.6, scale: 1.5 },
  'hoc-phi-thang': { id: 'hoc-phi-thang', spacing: 1.8, scale: 6.5, modelUrl: '/tieu-tien/models/books.glb' },
  'luong-toi-thieu': { id: 'luong-toi-thieu', spacing: 1.8, scale: 1.5 },
  'honda-vision': { id: 'honda-vision', spacing: 2.2, scale: 1.1 },
  'iphone': { id: 'iphone', spacing: 1.6, scale: 1.8 },
  'vf3': { id: 'vf3', spacing: 3.2, scale: 0.95, modelUrl: '/tieu-tien/models/car-compact.glb' },
  'vf8': { id: 'vf8', spacing: 3.8, scale: 1.25, modelUrl: '/tieu-tien/models/car-suv.glb' },
  'vf9': { id: 'vf9', spacing: 4.2, scale: 1.35, modelUrl: '/tieu-tien/models/car-luxury.glb' },
  'tram-y-te': { id: 'tram-y-te', spacing: 5.5, scale: 1.2 },
  'cau-dan-sinh': { id: 'cau-dan-sinh', spacing: 6.0, scale: 1.2 },
  'bv-huyen': { id: 'bv-huyen', spacing: 8.0, scale: 1.0, isLargeInfrastructure: true },
  'truong-noi-tru': { id: 'truong-noi-tru', spacing: 8.5, scale: 1.0, isLargeInfrastructure: true },
  'bv-lon': { id: 'bv-lon', spacing: 13.0, scale: 1.0, isLargeInfrastructure: true },
  'cau-tra-khuc': { id: 'cau-tra-khuc', spacing: 18.0, scale: 1.0, isLargeInfrastructure: true },
  'metro-1': { id: 'metro-1', spacing: 16.0, scale: 2.0, modelUrl: '/tieu-tien/models/metro.glb', isLargeInfrastructure: true },
  'cao-toc-bac-nam': { id: 'cao-toc-bac-nam', spacing: 16.0, scale: 1.0, isLargeInfrastructure: true },
  'long-thanh': { id: 'long-thanh', spacing: 22.0, scale: 1.0, isLargeInfrastructure: true },
  'dstdc': { id: 'dstdc', spacing: 18.0, scale: 2.0, modelUrl: '/tieu-tien/models/bullet-train.glb', isLargeInfrastructure: true },
};

/**
 * Xây dựng đoàn tàu metro 3 toa trên cầu cạn bê tông (viaduct) từ mô hình toa GLB đơn lẻ
 */
export function createMetroTrainGroup(
  baseCarModel: THREE_TYPE.Object3D,
  THREE: typeof THREE_TYPE
): THREE_TYPE.Group {
  const trainGroup = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.6 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.7 });

  // 1. Dầm cầu cạn bê tông
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 9.2), concreteMat);
  deck.position.y = 1.0;
  trainGroup.add(deck);

  // 2. 3 Trụ cầu cạn bê tông chữ T
  for (const z of [-3.2, 0, 3.2]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.8), pierMat);
    pier.position.set(0, 0.5, z);
    trainGroup.add(pier);
  }

  // 3. Hai ray thép
  for (const x of [-0.45, 0.45]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 9.0), railMat);
    rail.position.set(x, 1.21, 0);
    trainGroup.add(rail);
  }

  // 4. Đoàn 3 toa tàu metro
  // Toa đầu: z = -2.62
  const car1 = baseCarModel.clone(true);
  car1.position.set(0, 1.25, -2.62);
  trainGroup.add(car1);

  // Toa giữa: z = 0
  const car2 = baseCarModel.clone(true);
  car2.position.set(0, 1.25, 0);
  trainGroup.add(car2);

  // Toa đuôi: z = +2.62 (quay ngược lại 180 độ)
  const car3 = baseCarModel.clone(true);
  car3.rotateY(Math.PI);
  car3.position.set(0, 1.25, 2.62);
  trainGroup.add(car3);

  return trainGroup;
}

/**
 * Xây dựng đoàn tàu cao tốc 3 toa trên đường ray nổi cao tốc từ mô hình GLB đơn lẻ
 */
export function createBulletTrainGroup(
  baseCarModel: THREE_TYPE.Object3D,
  THREE: typeof THREE_TYPE
): THREE_TYPE.Group {
  const trainGroup = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });

  // 1. Dầm bê tông khí động học
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 9.8), concreteMat);
  deck.position.y = 1.0;
  trainGroup.add(deck);

  // 2. Trụ đỡ đường sắt cao tốc
  for (const z of [-3.5, 0, 3.5]) {
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 1.0, 12), pierMat);
    pier.position.set(0, 0.5, z);
    trainGroup.add(pier);
  }

  // 3. Đường ray thép
  for (const x of [-0.5, 0.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 9.6), railMat);
    rail.position.set(x, 1.21, 0);
    trainGroup.add(rail);
  }

  // 4. Đoàn 3 toa tàu cao tốc
  const car1 = baseCarModel.clone(true);
  car1.position.set(0, 1.25, -2.85);
  trainGroup.add(car1);

  const car2 = baseCarModel.clone(true);
  car2.position.set(0, 1.25, 0);
  trainGroup.add(car2);

  const car3 = baseCarModel.clone(true);
  car3.rotateY(Math.PI);
  car3.position.set(0, 1.25, 2.85);
  trainGroup.add(car3);

  return trainGroup;
}

/**
 * Xây dựng đối tượng 3D Procedural cho các vật phẩm không dùng GLB ngoài
 */
export function createProceduralMesh(
  itemId: string,
  THREE: typeof THREE_TYPE
): THREE_TYPE.Group {
  const group = new THREE.Group();

  switch (itemId) {
    case 've-phim': {
      // Thẻ vé xem phim màu đỏ hồng bo cạnh kèm ngôi sao vàng
      const cardMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.3 });
      const starMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2 });
      const borderMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

      const card = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.55), cardMat);
      card.position.y = 0.05;
      group.add(card);

      const stub = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.55), borderMat);
      stub.position.set(-0.25, 0.05, 0);
      group.add(stub);

      const star = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 5), starMat);
      star.position.set(0.1, 0.06, 0);
      group.add(star);
      break;
    }

    case 'luong-toi-thieu': {
      // Cọc tiền lương tiền mặt màu xanh lá kèm đai quấn vàng
      const billMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 });
      const strapMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });

      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 0.5), billMat);
      stack.position.y = 0.15;
      group.add(stack);

      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.52), strapMat);
      strap.position.y = 0.15;
      group.add(strap);
      break;
    }

    case 'honda-vision': {
      // Xe máy kiểu dáng phổ thông màu đỏ trắng (tỷ lệ xe máy nhỏ gọn: dài ~1.4, rộng ~0.45)
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.25 });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.3 });
      const lightMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.5 });

      // Bánh trước & sau
      const wheelGeom = new THREE.CylinderGeometry(0.26, 0.26, 0.09, 16);
      wheelGeom.rotateZ(Math.PI / 2);
      const frontWheel = new THREE.Mesh(wheelGeom, tireMat);
      frontWheel.position.set(0, 0.26, -0.55);
      const backWheel = new THREE.Mesh(wheelGeom, tireMat);
      backWheel.position.set(0, 0.26, 0.55);
      group.add(frontWheel, backWheel);

      // Thân xe
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.95), bodyMat);
      body.position.set(0, 0.48, 0.05);
      group.add(body);

      // Yên xe
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.6), seatMat);
      seat.position.set(0, 0.7, 0.18);
      group.add(seat);

      // Cổ xe & Ghi-đông
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45), metalMat);
      fork.position.set(0, 0.68, -0.48);
      fork.rotateX(0.2);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.04), metalMat);
      handle.position.set(0, 0.86, -0.44);
      group.add(fork, handle);

      // Đèn pha
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.05), lightMat);
      lamp.position.set(0, 0.8, -0.56);
      group.add(lamp);
      break;
    }

    case 'iphone': {
      // Điện thoại thông minh viền kim loại bo tròn, kính trước, cụm 3 camera sau
      const phoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
      const screenMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.1 });
      const lensMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.05, metalness: 0.9 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 1.0), phoneMat);
      body.position.y = 0.02;
      group.add(body);

      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.01, 0.92), screenMat);
      screen.position.set(0, 0.042, 0);
      group.add(screen);

      const camBump = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.22), phoneMat);
      camBump.position.set(-0.12, 0.01, -0.35);
      group.add(camBump);

      const lensGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12);
      const l1 = new THREE.Mesh(lensGeom, lensMat);
      l1.position.set(-0.16, 0.025, -0.4);
      const l2 = new THREE.Mesh(lensGeom, lensMat);
      l2.position.set(-0.08, 0.025, -0.4);
      const l3 = new THREE.Mesh(lensGeom, lensMat);
      l3.position.set(-0.12, 0.025, -0.3);
      group.add(l1, l2, l3);
      break;
    }

    case 'tram-y-te': {
      // Trạm y tế xã: nhà trắng mái dốc kèm chữ thập đỏ (kích thước ~4.5 x 3.2 x 2.8)
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3 });

      const building = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 2.4), wallMat);
      building.position.y = 0.9;
      group.add(building);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.0, 4), roofMat);
      roof.position.y = 2.3;
      roof.rotateY(Math.PI / 4);
      group.add(roof);

      const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.05), doorMat);
      door.position.set(0, 0.55, 1.21);
      group.add(door);

      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.02), redMat);
      crossV.position.set(0, 1.45, 1.21);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.02), redMat);
      crossH.position.set(0, 1.45, 1.21);
      group.add(crossV, crossH);
      break;
    }

    case 'cau-dan-sinh': {
      // Cầu dân sinh miền núi: trụ mố đá, mặt sàn gỗ, dây cáp treo (kích thước ~5.0 x 2.4)
      const plankMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
      const pierMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.6 });
      const cableMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 });
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1 });

      const water = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.1, 2.4), waterMat);
      water.position.y = 0.05;
      group.add(water);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.14, 1.1), plankMat);
      deck.position.y = 0.9;
      group.add(deck);

      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.8, 0.35), pierMat);
      p1.position.set(-1.8, 0.9, 0);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.8, 0.35), pierMat);
      p2.position.set(1.8, 0.9, 0);
      group.add(p1, p2);

      const cableGeom = new THREE.CylinderGeometry(0.035, 0.035, 4.2);
      cableGeom.rotateZ(Math.PI / 2);
      const cLeft = new THREE.Mesh(cableGeom, cableMat);
      cLeft.position.set(0, 1.5, -0.5);
      const cRight = new THREE.Mesh(cableGeom, cableMat);
      cRight.position.set(0, 1.5, 0.5);
      group.add(cLeft, cRight);
      break;
    }

    case 'bv-huyen': {
      // Bệnh viện đa khoa huyện: khối nhà 3 tầng, chữ thập y tế (kích thước ~6.0 x 3.5 x 3.8)
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });

      const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 4.0), baseMat);
      base.position.y = 0.1;
      group.add(base);

      const mainBlock = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.0, 3.2), wallMat);
      mainBlock.position.y = 1.6;
      group.add(mainBlock);

      // Dải cửa kính các tầng
      for (let y = 0.8; y <= 2.4; y += 0.8) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.35, 3.25), glassMat);
        stripe.position.set(0, y, 0);
        group.add(stripe);
      }

      // Biểu tượng chữ thập đỏ trên đỉnh
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.12), redMat);
      crossV.position.set(0, 3.5, 0);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.12), redMat);
      crossH.position.set(0, 3.5, 0);
      group.add(crossV, crossH);
      break;
    }

    case 'truong-noi-tru': {
      // Trường nội trú liên cấp vùng biên: khối phòng học mái ngói đỏ, tháp đồng hồ & cột cờ (kích thước ~6.5 x 3.5 x 4.2)
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4 });
      const flagMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8 });
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.6 });

      const base = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.2, 4.2), baseMat);
      base.position.y = 0.1;
      group.add(base);

      const school = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.2, 2.8), wallMat);
      school.position.y = 1.2;
      group.add(school);

      // Mái dốc ngói
      const roofGeom = new THREE.ConeGeometry(3.6, 1.2, 4);
      roofGeom.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeom, roofMat);
      roof.position.y = 2.9;
      roof.scale.set(1.2, 1, 0.8);
      group.add(roof);

      // Tháp đồng hồ giữa
      const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 1.2), wallMat);
      tower.position.set(0, 2.8, 0);
      const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.9, 4), roofMat);
      towerRoof.position.set(0, 4.15, 0);
      towerRoof.rotateY(Math.PI / 4);
      group.add(tower, towerRoof);

      // Cột cờ đỏ sao vàng
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6), poleMat);
      pole.position.set(2.6, 1.3, 1.6);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.02), flagMat);
      flag.position.set(2.9, 2.3, 1.6);
      group.add(pole, flag);
      break;
    }

    case 'bv-lon': {
      // Bệnh viện lớn cửa ngõ: tổ hợp toà nhà hiện đại kèm sân đỗ trực thăng Helipad (kích thước ~12.0 x 7.5 x 5.5)
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1 });
      const heliMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
      const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });

      // Khối toà nhà chính
      const mainTower = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.6, 3.6), wallMat);
      mainTower.position.set(-1.2, 2.3, 0);
      group.add(mainTower);

      // Cửa kính mặt dựng hiện đại
      const glassFacade = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.6, 3.66), glassMat);
      glassFacade.position.set(-1.2, 2.3, 0);
      group.add(glassFacade);

      // Khối khám chữa bệnh & Cấp cứu (side wing)
      const emergencyWing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.2, 3.2), wallMat);
      emergencyWing.position.set(3.4, 1.6, 0.2);
      group.add(emergencyWing);

      // Sân đỗ trực thăng Helipad trên đỉnh khối khám
      const helipad = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.1, 32), heliMat);
      helipad.position.set(3.4, 3.25, 0.2);
      const hMarkV1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.9), yellowMat);
      hMarkV1.position.set(3.1, 3.32, 0.2);
      const hMarkV2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.9), yellowMat);
      hMarkV2.position.set(3.7, 3.32, 0.2);
      const hMarkBar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.18), yellowMat);
      hMarkBar.position.set(3.4, 3.32, 0.2);
      group.add(helipad, hMarkV1, hMarkV2, hMarkBar);

      // Xe cấp cứu trắng đỏ trước cửa
      const ambBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.8), wallMat);
      ambBody.position.set(3.4, 0.35, 2.2);
      const ambStripe = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.15, 0.82), redMat);
      ambStripe.position.set(3.4, 0.35, 2.2);
      group.add(ambBody, ambStripe);
      break;
    }

    case 'cau-tra-khuc': {
      // Cầu Trà Khúc: Cầu dây văng hiện đại nhịp lớn bắc qua sông (kích thước ~20.0 x 6.0 x 6.0)
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
      const cableMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.2 });
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1 });
      const pierMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });

      // Mặt nước sông Trà Khúc
      const water = new THREE.Mesh(new THREE.BoxGeometry(20.0, 0.1, 6.0), waterMat);
      water.position.y = 0.05;
      group.add(water);

      // Mặt cầu dây văng
      const deck = new THREE.Mesh(new THREE.BoxGeometry(20.0, 0.25, 2.2), deckMat);
      deck.position.y = 1.1;
      group.add(deck);

      // Trụ mố cầu dưới nước
      for (const px of [-5.0, 5.0]) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 2.4), pierMat);
        pier.position.set(px, 0.55, 0);
        group.add(pier);

        // Tháp dây văng chữ A vút cao
        const towerL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 5.2, 8), pylonMat);
        towerL.position.set(px, 3.5, -0.6);
        towerL.rotateZ(px > 0 ? 0.08 : -0.08);
        const towerR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 5.2, 8), pylonMat);
        towerR.position.set(px, 3.5, 0.6);
        towerR.rotateZ(px > 0 ? 0.08 : -0.08);
        group.add(towerL, towerR);

        // Các dây văng rẻ quạt
        for (let dx = -4.0; dx <= 4.0; dx += 1.2) {
          if (Math.abs(dx) < 0.2) continue;
          const cableGeom = new THREE.CylinderGeometry(0.02, 0.02, 3.8);
          const cable = new THREE.Mesh(cableGeom, cableMat);
          cable.position.set(px + dx / 2, 2.8, 0);
          cable.rotateZ(dx > 0 ? -0.45 : 0.45);
          group.add(cable);
        }
      }
      break;
    }

    case 'cao-toc-bac-nam': {
      // Đoạn cao tốc Bắc - Nam 4 làn xe quy mô lớn kèm dải phân cách và biển báo vượt (kích thước ~18.0 x 5.0)
      const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 });
      const medianGreenMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 });
      const signMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.3 });

      // Lòng đường cao tốc 4 làn xe
      const road = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.2, 4.8), roadMat);
      road.position.y = 0.1;
      group.add(road);

      // Dải phân cách giữa có cây chống lóa
      const median = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.35, 0.3), medianGreenMat);
      median.position.set(0, 0.28, 0);
      group.add(median);

      // Hộ lan lượn sóng 2 bên mép cao tốc
      for (const z of [-2.35, 2.35]) {
        const guard = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.3, 0.08), barrierMat);
        guard.position.set(0, 0.3, z);
        group.add(guard);
      }

      // Vạch kẻ đường đứt nét
      for (const z of [-1.15, 1.15]) {
        for (let x = -8.0; x <= 8.0; x += 2.0) {
          const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.21, 0.08), lineMat);
          dash.position.set(x, 0.11, z);
          group.add(dash);
        }
      }

      // Khung biển báo giá long môn trên cao
      const gantryP1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6), barrierMat);
      gantryP1.position.set(3.0, 1.3, -2.4);
      const gantryP2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6), barrierMat);
      gantryP2.position.set(3.0, 1.3, 2.4);
      const gantryBeam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.9), barrierMat);
      gantryBeam.position.set(3.0, 2.5, 0);

      const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 2.2), signMat);
      signBoard.position.set(3.0, 2.5, 0);
      group.add(gantryP1, gantryP2, gantryBeam, signBoard);
      break;
    }

    case 'long-thanh': {
      // Sân bay quốc tế Long Thành: Nhà ga hiện đại, đường băng tarmac, đài kiểm soát không lưu & máy bay phản lực (kích thước ~22.0 x 13.0 x 6.5)
      const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const terminalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.2 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1 });
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const planeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

      // Mặt đường băng và sân đỗ Tarmac
      const tarmac = new THREE.Mesh(new THREE.BoxGeometry(22.0, 0.15, 13.0), tarmacMat);
      tarmac.position.y = 0.075;
      group.add(tarmac);

      // Vạch sơn đường băng
      for (let x = -9.0; x <= 9.0; x += 3.0) {
        const rStripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 0.25), lineMat);
        rStripe.position.set(x, 0.08, 4.5);
        group.add(rStripe);
      }

      // Nhà ga hành khách hoa sen hiện đại
      const terminalMain = new THREE.Mesh(new THREE.BoxGeometry(11.0, 2.2, 3.4), terminalMat);
      terminalMain.position.set(-2.0, 1.15, -3.2);
      const termGlass = new THREE.Mesh(new THREE.BoxGeometry(10.6, 1.2, 3.44), glassMat);
      termGlass.position.set(-2.0, 1.0, -3.2);
      group.add(terminalMain, termGlass);

      // Cánh concourse vươn ra đón máy bay
      const concourseL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 3.0), terminalMat);
      concourseL.position.set(-6.5, 0.75, -0.6);
      const concourseR = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 3.0), terminalMat);
      concourseR.position.set(2.5, 0.75, -0.6);
      group.add(concourseL, concourseR);

      // Đài kiểm soát không lưu (ATC Tower) vút cao
      const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 5.2, 16), terminalMat);
      towerBase.position.set(-8.5, 2.6, -3.2);
      const towerCab = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.1, 16), glassMat);
      towerCab.position.set(-8.5, 5.3, -3.2);
      const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 16), terminalMat);
      towerRoof.position.set(-8.5, 6.0, -3.2);
      group.add(towerBase, towerCab, towerRoof);

      // Máy bay phản lực thương mại lớn đang đậu tại ống lồng
      const createPlane = (px: number, pz: number, rot: number, scale = 1.0) => {
        const plane = new THREE.Group();
        plane.position.set(px, 0.6, pz);
        plane.rotateY(rot);
        plane.scale.setScalar(scale);

        const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 4.2, 12), planeMat);
        fuselage.rotateZ(Math.PI / 2);
        const wings = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 4.6), planeMat);
        wings.position.set(0.2, 0.05, 0);
        const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.06), planeMat);
        tailFin.position.set(-1.6, 0.5, 0);

        plane.add(fuselage, wings, tailFin);
        return plane;
      };

      const plane1 = createPlane(-4.5, 0.8, -Math.PI / 12, 1.1);
      const plane2 = createPlane(5.5, 2.2, -Math.PI / 4, 0.9);
      group.add(plane1, plane2);
      break;
    }

    case 'metro-1': {
      // Procedural fallback cho Tuyến Metro số 1 Bến Thành – Suối Tiên (đoàn 3 toa)
      const concreteMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.6 });
      const trainBodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
      const windowMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1 });

      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 16.0), concreteMat);
      deck.position.y = 1.0;
      group.add(deck);

      for (const z of [-5.0, 0, 5.0]) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.8), concreteMat);
        pier.position.set(0, 0.5, z);
        group.add(pier);
      }

      for (const z of [-4.5, 0, 4.5]) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 4.0), trainBodyMat);
        car.position.set(0, 2.1, z);
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.6, 3.6), windowMat);
        win.position.set(0, 2.2, z);
        group.add(car, win);
      }
      break;
    }

    case 'dstdc': {
      // Procedural fallback cho Đường sắt tốc độ cao Bắc – Nam (đoàn 3 toa)
      const concreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
      const trainBodyMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
      const windowMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });

      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 18.0), concreteMat);
      deck.position.y = 1.0;
      group.add(deck);

      for (const z of [-6.0, 0, 6.0]) {
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 1.0, 12), concreteMat);
        pier.position.set(0, 0.5, z);
        group.add(pier);
      }

      for (const z of [-5.2, 0, 5.2]) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 4.6), trainBodyMat);
        car.position.set(0, 2.05, z);
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.5, 4.2), windowMat);
        win.position.set(0, 2.1, z);
        group.add(car, win);
      }
      break;
    }

    default: {
      const defMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), defMat);
      cube.position.y = 0.5;
      group.add(cube);
      break;
    }
  }

  return group;
}
