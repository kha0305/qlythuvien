// Lỗi nghiệp vụ có mã HTTP, được error handler ở index.ts chuyển thành JSON.
export class AppError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AppError';
  }
}
