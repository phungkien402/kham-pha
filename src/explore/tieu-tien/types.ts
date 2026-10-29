// src/explore/tieu-tien/types.ts
// Định nghĩa kiểu dữ liệu cho trò chơi "1 ngày làm PNV" (/tieu-tien)

export type NhomVatPham = 'doi-thuong' | 'xe-nha' | 'cong-dong' | 'ha-tang';

export interface VatPham {
  id: string;
  ten: string;
  nhom: NhomVatPham;
  gia: number;
  donVi: string;
  giaKhoang: boolean;
  emoji: string;
  phamVi: string;
  nguon: string;
  ngayNguon: string;
  ngayTruyCap: string;
  tranhCai: boolean;
}

export interface NganSachConfig {
  usd: number;
  nguon: string;
  ghiChu: string;
  ngay: string;
  tyGia: number;
  tyGiaLoai: string;
  tyGiaNguon: string;
  tyGiaNgay: string;
}

export interface DuLieuTieuTien {
  phienBan: string;
  nganSach: NganSachConfig;
  vatPham: VatPham[];
}

export type GioHang = Record<string, number>;

export interface LichSuHanhDong {
  itemId: string;
  count: number;
  gia: number;
}

export interface ThongKeNhom {
  nhom: NhomVatPham;
  tenNhom: string;
  tongTien: number;
  tyLe: number; // 0..100 (%)
  soMon: number;
}

export interface Milestone {
  id: string;
  tiLe: number; // 0.0001 (0.01%), 0.001 (0.1%), 0.01 (1%), 0.1 (10%)
  nhan: string;
  tieuDe: string;
  noiDung: string;
}

export interface ThoiGianTieuHet {
  totalSeconds: number;
  years: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  formattedText: string;
}
