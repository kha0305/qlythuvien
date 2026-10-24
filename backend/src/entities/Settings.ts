// Tham số nghiệp vụ (D3): admin sửa được, chỉ áp dụng cho phiếu tạo sau (D10).
export class Settings {
  id: number;
  loanDays: number;
  finePerDay: number;
  maxBooksPerReader: number;
  reservationHours: number;

  constructor(data: {
    id?: number;
    loanDays?: number;
    finePerDay?: number;
    maxBooksPerReader?: number;
    reservationHours?: number;
  } = {}) {
    this.id = data.id ?? 1;
    this.loanDays = data.loanDays ?? 14;
    this.finePerDay = data.finePerDay ?? 5000;
    this.maxBooksPerReader = data.maxBooksPerReader ?? 5;
    this.reservationHours = data.reservationHours ?? 48;
  }
}
