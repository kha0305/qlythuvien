import { config } from '../config';
import { ensureEmailSchema } from '../db/ensureEmailSchema';
import { LoanRepository } from '../repositories/LoanRepository';
import { EmailReminderRepository } from '../repositories/EmailReminderRepository';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { planReminders } from '../utils/reminderPlan';
import { EmailService, emailFooterText, wrapEmailHtml } from './EmailService';

export interface ReminderRunSummary {
  enabled: boolean;
  scanned: number;
  sent: number;
  failed: number;
}

/**
 * UC17: quét các phiếu đang mượn và gửi email nhắc sắp đến hạn / quá hạn qua Resend.
 * Chống trùng bằng bảng email_reminders + logic ở utils/reminderPlan (unit test riêng).
 * Mọi lỗi gửi đều được bắt: 1 email lỗi không làm sập vòng quét lẫn cả ứng dụng.
 */
export class ReminderService {
  constructor(
    private readonly emailService = new EmailService(),
    private readonly loanRepo = new LoanRepository(),
    private readonly reminderRepo = new EmailReminderRepository(),
    private readonly settingsRepo = new SettingsRepository(),
  ) {}

  async runOnce(now: Date = new Date()): Promise<ReminderRunSummary> {
    if (!this.emailService.isEnabled()) {
      return { enabled: false, scanned: 0, sent: 0, failed: 0 };
    }
    await ensureEmailSchema();
    const loans = await this.loanRepo.findAllBorrowing();
    const lastSent = await this.reminderRepo.lastSentMap(loans.map((l) => l.id));
    const plans = planReminders(
      loans.map((l) => ({ loanId: l.id, status: l.status, dueAt: l.dueAt, readerEmail: l.reader.email })),
      lastSent,
      now,
    );
    const settings = await this.settingsRepo.get();
    const byId = new Map(loans.map((l) => [l.id, l]));
    let sent = 0;
    let failed = 0;
    for (const plan of plans) {
      const loan = byId.get(plan.loanId);
      if (!loan || !loan.reader.email) continue;
      const dueText = loan.dueAt.toLocaleDateString('vi-VN');
      const isOverdue = plan.type === 'overdue';
      const fine = plan.overdueDays * settings.finePerDay;
      const subject = isOverdue
        ? `[Thư viện Đại học] Sách "${loan.book.title}" đã quá hạn ${plan.overdueDays} ngày`
        : `[Thư viện Đại học] Sách "${loan.book.title}" sắp đến hạn trả (${dueText})`;
      const paragraphs = isOverdue
        ? [
            `Xin chào ${loan.reader.fullName},`,
            `Sách <strong>"${loan.book.title}"</strong> bạn mượn đã <strong>quá hạn ${plan.overdueDays} ngày</strong>. Tiền phạt sẽ tiếp tục tăng mỗi ngày — vui lòng mang sách đến thư viện trả sớm nhất có thể.`,
          ]
        : [
            `Xin chào ${loan.reader.fullName},`,
            `Sách <strong>"${loan.book.title}"</strong> bạn đang mượn sắp đến hạn trả. Vui lòng trả sách đúng hạn để không bị tính phí phạt.`,
          ];
      const infoRows = [
        { label: 'Sách', value: loan.book.title },
        { label: 'Hạn trả', value: dueText },
        ...(isOverdue
          ? [
              { label: 'Đã quá hạn', value: `${plan.overdueDays} ngày` },
              {
                label: 'Phạt tạm tính',
                value: `${fine.toLocaleString('vi-VN')} đồng (${settings.finePerDay.toLocaleString('vi-VN')} đồng/ngày)`,
              },
            ]
          : [{ label: 'Trạng thái', value: 'Sắp đến hạn' }]),
      ];
      const text = paragraphs.map((p) => p.replace(/<[^>]+>/g, '')).join('\n') + emailFooterText();
      try {
        const providerId = await this.emailService.send({
          to: loan.reader.email,
          subject,
          text,
          html: wrapEmailHtml(subject.replace('[Thư viện Đại học] ', ''), paragraphs, `${config.mail.appBaseUrl}/my-books`, 'Xem sách đang mượn', infoRows),
        });
        await this.reminderRepo.record(loan.id, plan.type, loan.reader.email, providerId);
        sent++;
      } catch (err) {
        failed++;
        console.error(`[email] Gửi nhắc hạn thất bại (loan ${loan.id}):`, err instanceof Error ? err.message : err);
      }
    }
    if (sent > 0 || failed > 0) {
      console.log(`[email] Nhắc hạn: quét ${loans.length} phiếu, gửi ${sent}, lỗi ${failed}.`);
    }
    return { enabled: true, scanned: loans.length, sent, failed };
  }
}
