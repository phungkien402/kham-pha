// src/explore/tieu-tien/models3d.ts
// Quản lý và khởi tạo hình học 3D (GLB CC0 và Three.js Low-poly Primitives)

import type * as THREE_TYPE from 'three';

export interface Item3DDefinition {
  id: string;
  spacing: number;
  scale: number;
  modelUrl?: string; // File GLB trong /tieu-tien/models/
  isLargeInfrastructure?: boolean; // Công trình lớn chỉ hiện 1 mô hình to
}

export const ITEM_3D_CONFIG: Record<string, Item3DDefinition> = {
  'tra-da': { id: 'tra-da', spacing: 1.3, scale: 1.6, modelUrl: '/tieu-tien/models/tra-da.glb' },
  'pho': { id: 'pho', spacing: 1.5, scale: 1.6, modelUrl: '/tieu-tien/models/pho.glb' },
  've-phim': { id: 've-phim', spacing: 1.2, scale: 1.0 },
  'hoc-phi-thang': { id: 'hoc-phi-thang', spacing: 1.5, scale: 1.5, modelUrl: '/tieu-tien/models/books.glb' },
  'luong-toi-thieu': { id: 'luong-toi-thieu', spacing: 1.4, scale: 1.0 },
  'honda-vision': { id: 'honda-vision', spacing: 2.2, scale: 1.0 },
  'iphone': { id: 'iphone', spacing: 1.2, scale: 1.0 },
  'vf3': { id: 'vf3', spacing: 3.2, scale: 1.0, modelUrl: '/tieu-tien/models/car-compact.glb' },
  'vf8': { id: 'vf8', spacing: 3.6, scale: 1.0, modelUrl: '/tieu-tien/models/car-suv.glb' },
  'vf9': { id: 'vf9', spacing: 3.8, scale: 1.0, modelUrl: '/tieu-tien/models/car-luxury.glb' },
  'tram-y-te': { id: 'tram-y-te', spacing: 4.5, scale: 1.0 },
  'cau-dan-sinh': { id: 'cau-dan-sinh', spacing: 5.0, scale: 1.0 },
  'bv-huyen': { id: 'bv-huyen', spacing: 6.0, scale: 1.0, isLargeInfrastructure: true },
  'truong-noi-tru': { id: 'truong-noi-tru', spacing: 6.0, scale: 1.0, isLargeInfrastructure: true },
  'bv-lon': { id: 'bv-lon', spacing: 7.5, scale: 1.2, isLargeInfrastructure: true },
  'cau-tra-khuc': { id: 'cau-tra-khuc', spacing: 8.0, scale: 1.2, isLargeInfrastructure: true },
  'metro-1': { id: 'metro-1', spacing: 6.0, scale: 1.2, modelUrl: '/tieu-tien/models/metro.glb', isLargeInfrastructure: true },
  'cao-toc-bac-nam': { id: 'cao-toc-bac-nam', spacing: 8.5, scale: 1.2, isLargeInfrastructure: true },
  'long-thanh': { id: 'long-thanh', spacing: 10.0, scale: 1.3, isLargeInfrastructure: true },
  'dstdc': { id: 'dstdc', spacing: 7.0, scale: 1.2, modelUrl: '/tieu-tien/models/bullet-train.glb', isLargeInfrastructure: true },
};

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
      // Xe máy kiểu dáng phổ thông màu đỏ trắng (không logo thương hiệu)
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.25 });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.3 });
      const lightMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.5 });

      // Bánh trước & sau
      const wheelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
      wheelGeom.rotateZ(Math.PI / 2);
      const frontWheel = new THREE.Mesh(wheelGeom, tireMat);
      frontWheel.position.set(0, 0.3, -0.65);
      const backWheel = new THREE.Mesh(wheelGeom, tireMat);
      backWheel.position.set(0, 0.3, 0.65);
      group.add(frontWheel, backWheel);

      // Thân xe
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 1.1), bodyMat);
      body.position.set(0, 0.55, 0.05);
      group.add(body);

      // Yên xe
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.7), seatMat);
      seat.position.set(0, 0.8, 0.2);
      group.add(seat);

      // Cổ xe & Ghi-đông
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), metalMat);
      fork.position.set(0, 0.75, -0.55);
      fork.rotateX(0.2);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.05, 0.05), metalMat);
      handle.position.set(0, 0.95, -0.5);
      group.add(fork, handle);

      // Đèn pha
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.06), lightMat);
      lamp.position.set(0, 0.88, -0.65);
      group.add(lamp);
      break;
    }

    case 'iphone': {
      // Điện thoại thông minh viền kim loại bo tròn, kính trước, cụm 3 camera sau
      const phoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
      const screenMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.1 });
      const lensMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.05, metalness: 0.9 });

      // Thân máy mỏng
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 1.0), phoneMat);
      body.position.y = 0.02;
      group.add(body);

      // Mặt kính màn hình
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.01, 0.92), screenMat);
      screen.position.set(0, 0.042, 0);
      group.add(screen);

      // Cụm camera lồi
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
      // Trạm y tế xã: nhà trắng mái dốc kèm chữ thập đỏ
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3 });

      const building = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.8), wallMat);
      building.position.y = 0.7;
      group.add(building);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.8, 4), roofMat);
      roof.position.y = 1.8;
      roof.rotateY(Math.PI / 4);
      group.add(roof);

      // Cửa chính
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.05), doorMat);
      door.position.set(0, 0.4, 0.91);
      group.add(door);

      // Dấu thập đỏ (+)
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.02), redMat);
      crossV.position.set(0, 1.15, 0.91);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.02), redMat);
      crossH.position.set(0, 1.15, 0.91);
      group.add(crossV, crossH);
      break;
    }

    case 'cau-dan-sinh': {
      // Cầu dân sinh miền núi: trụ mố đá, mặt sàn gỗ, dây cáp treo
      const plankMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
      const pierMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.6 });
      const cableMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 });
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1 });

      // Làn nước suối bên dưới
      const water = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 1.8), waterMat);
      water.position.y = 0.05;
      group.add(water);

      // Mặt sàn cầu gỗ
      const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.9), plankMat);
      deck.position.y = 0.8;
      group.add(deck);

      // 2 Cột tháp cầu
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), pierMat);
      p1.position.set(-1.4, 0.8, 0);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), pierMat);
      p2.position.set(1.4, 0.8, 0);
      group.add(p1, p2);

      // Dây cáp treo 2 bên
      const cableGeom = new THREE.CylinderGeometry(0.03, 0.03, 3.2);
      cableGeom.rotateZ(Math.PI / 2);
      const cLeft = new THREE.Mesh(cableGeom, cableMat);
      cLeft.position.set(0, 1.35, -0.4);
      const cRight = new THREE.Mesh(cableGeom, cableMat);
      cRight.position.set(0, 1.35, 0.4);
      group.add(cLeft, cRight);
      break;
    }

    case 'bv-huyen': {
      // Bệnh viện đa khoa huyện: khối nhà 3 tầng, chữ thập y tế
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });

      const mainBlock = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 2.2), wallMat);
      mainBlock.position.y = 1.1;
      group.add(mainBlock);

      // Dải cửa kính các tầng
      for (let y = 0.5; y <= 1.7; y += 0.6) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 2.22), glassMat);
        stripe.position.set(0, y, 0);
        group.add(stripe);
      }

      // Biểu tượng chữ thập đỏ trên đỉnh
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.1), redMat);
      crossV.position.set(0, 2.5, 0);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.1), redMat);
      crossH.position.set(0, 2.5, 0);
      group.add(crossV, crossH);
      break;
    }

    case 'truong-noi-tru': {
      // Trường nội trú liên cấp: dãy phòng học mái ngói đỏ kèm tháp đồng hồ & cột cờ
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4 });
      const flagMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8 });

      const b1 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.6, 1.8), wallMat);
      b1.position.y = 0.8;
      group.add(b1);

      // Mái dốc ngói
      const roofGeom = new THREE.ConeGeometry(2.4, 0.9, 4);
      roofGeom.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeom, roofMat);
      roof.position.y = 2.05;
      roof.scale.set(1.2, 1, 0.8);
      group.add(roof);

      // Tháp đồng hồ giữa
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), wallMat);
      tower.position.set(0, 2.0, 0);
      const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.6, 4), roofMat);
      towerRoof.position.set(0, 2.9, 0);
      towerRoof.rotateY(Math.PI / 4);
      group.add(tower, towerRoof);

      // Cột cờ
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8), poleMat);
      pole.position.set(1.8, 0.9, 1.3);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.02), flagMat);
      flag.position.set(2.0, 1.6, 1.3);
      group.add(pole, flag);
      break;
    }

    case 'bv-lon': {
      // Bệnh viện lớn cửa ngõ: tổ hợp toà nhà hiện đại kèm sân đỗ trực thăng Helipad (H)
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1 });
      const heliMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
      const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });

      const wingA = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.8, 2.0), wallMat);
      wingA.position.set(-0.6, 1.4, 0);
      const wingB = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.6, 1.8), wallMat);
      wingB.position.set(1.2, 1.8, 0.2);
      group.add(wingA, wingB);

      // Kính mặt dựng
      const glassStrip = new THREE.Mesh(new THREE.BoxGeometry(3.42, 1.8, 1.4), glassMat);
      glassStrip.position.set(-0.6, 1.4, 0);
      group.add(glassStrip);

      // Bãi đáp trực thăng Helipad
      const helipad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 24), heliMat);
      helipad.position.set(1.2, 3.63, 0.2);
      const hMark = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), yellowMat);
      hMark.position.set(1.2, 3.64, 0.2);
      group.add(helipad, hMark);
      break;
    }

    case 'cau-tra-khuc': {
      // Cầu Trà Khúc: Cầu dây văng hiện đại nhịp lớn bắc qua sông
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
      const cableMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.2 });
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.1 });

      const water = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.1, 3.0), waterMat);
      water.position.y = 0.05;
      group.add(water);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.2, 1.2), deckMat);
      deck.position.y = 0.9;
      group.add(deck);

      // 2 Tháp chữ A dây văng
      for (const x of [-1.5, 1.5]) {
        const tower = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.0, 4), pylonMat);
        tower.position.set(x, 2.0, 0);
        group.add(tower);

        // Dây văng rẻ quạt
        for (let dx = -1.2; dx <= 1.2; dx += 0.6) {
          if (Math.abs(dx) < 0.1) continue;
          const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6), cableMat);
          cable.position.set(x + dx / 2, 1.7, 0);
          cable.rotateZ(dx > 0 ? -0.4 : 0.4);
          group.add(cable);
        }
      }
      break;
    }

    case 'cao-toc-bac-nam': {
      // Đoạn cao tốc Bắc - Nam 4 làn xe kèm dải phân cách và biển báo vượt
      const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 });
      const signMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.3 });

      const road = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.15, 2.6), roadMat);
      road.position.y = 0.08;
      group.add(road);

      // Dải phân cách giữa
      const median = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.25, 0.2), barrierMat);
      median.position.set(0, 0.2, 0);
      group.add(median);

      // Vạch kẻ đường
      for (let z of [-0.6, 0.6]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.16, 0.06), lineMat);
        stripe.position.set(0, 0.09, z);
        group.add(stripe);
      }

      // Khung biển báo trên cao
      const gantryP1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8), barrierMat);
      gantryP1.position.set(1.5, 0.9, -1.35);
      const gantryP2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8), barrierMat);
      gantryP2.position.set(1.5, 0.9, 1.35);
      const gantryBeam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.8), barrierMat);
      gantryBeam.position.set(1.5, 1.75, 0);

      const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 1.4), signMat);
      signBoard.position.set(1.5, 1.75, 0);
      group.add(gantryP1, gantryP2, gantryBeam, signBoard);
      break;
    }

    case 'long-thanh': {
      // Sân bay quốc tế Long Thành: Nhà ga hiện đại, đài kiểm soát không lưu và máy bay phản lực
      const terminalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.2 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1 });
      const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const planeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

      // Đường băng tarmac
      const tarmac = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.1, 4.0), tarmacMat);
      tarmac.position.y = 0.05;
      group.add(tarmac);

      // Nhà ga hành khách mái lượn
      const terminal = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 1.6), terminalMat);
      terminal.position.set(-1.0, 0.65, -0.8);
      const termGlass = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.6, 1.62), glassMat);
      termGlass.position.set(-1.0, 0.5, -0.8);
      group.add(terminal, termGlass);

      // Tháp không lưu cao
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.8, 12), terminalMat);
      tower.position.set(-2.6, 1.4, -0.8);
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 0.5, 12), glassMat);
      cab.position.set(-2.6, 2.7, -0.8);
      group.add(tower, cab);

      // Máy bay phản lực chở khách trên sân đỗ
      const plane = new THREE.Group();
      plane.position.set(1.5, 0.45, 0.8);
      plane.rotateY(-Math.PI / 6);

      const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 2.2, 12), planeMat);
      fuselage.rotateZ(Math.PI / 2);
      const wings = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 2.4), planeMat);
      wings.position.set(0.1, 0.02, 0);
      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.04), planeMat);
      tailFin.position.set(-0.85, 0.3, 0);

      plane.add(fuselage, wings, tailFin);
      group.add(plane);
      break;
    }

    default: {
      // Khối dự phòng nếu không rõ id
      const defMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), defMat);
      cube.position.y = 0.5;
      group.add(cube);
      break;
    }
  }

  return group;
}
