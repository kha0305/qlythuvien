import { config } from '../config';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * UC17-UC19: gửi email qua Resend HTTP API (không thêm dependency).
 * Chưa cấu hình RESEND_API_KEY -> isEnabled() = false, mọi tính năng email tự tắt gọn.
 */
export class EmailService {
  isEnabled(): boolean {
    return Boolean(config.mail.resendApiKey);
  }

  /** Gửi 1 email. Thành công trả về id của Resend; lỗi thì ném Error để caller tự xử lý. */
  async send(email: OutgoingEmail): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Chưa cấu hình RESEND_API_KEY');
    }
    const response = await fetch(`${config.mail.apiUrl}/emails`, {
      method: 'POST',
      headers: {
        Authorization: ['Bearer', config.mail.resendApiKey].join(' '),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.mail.from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.html ? { html: email.html } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok || !payload?.id) {
      throw new Error(`Resend từ chối gửi email (HTTP ${response.status}): ${payload?.message ?? 'không rõ lý do'}`);
    }
    return payload.id;
  }
}

/** Footer dạng text thuần, nối vào cuối trường text của mọi email hệ thống. */
export function emailFooterText(): string {
  const base = config.mail.appBaseUrl;
  return `\n\n—\nThư viện Mini — ${base}\nTrang chủ: ${base}/ · Đăng nhập: ${base}/login · Sách đang mượn: ${base}/my-books\nBạn nhận được email này vì địa chỉ của bạn được đăng ký tại Thư viện Mini.\n© 2026 Thư viện Mini. Email tự động — vui lòng không trả lời.`;
}

/** 1 dòng trong bảng thông tin của email (nhãn bên trái, giá trị đậm bên phải). */
export interface EmailInfoRow {
  label: string;
  value: string;
}

function escapeHtml(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Mẫu email hệ thống (mẫu D — kha duyệt 23/10/2026): nền xanh đậm toàn thư, thẻ trắng nổi,
 * vạch vàng trên đầu thẻ, bảng thông tin, nút vàng, footer trong thẻ.
 * Dựng bằng bảng + CSS inline để Gmail/Outlook hiển thị giống nhau.
 * paragraphs được phép chứa <strong> (nội dung do code hệ thống tạo); infoRows là dữ liệu thuần, tự escape.
 */
export function wrapEmailHtml(
  title: string,
  paragraphs: string[],
  actionUrl?: string,
  actionLabel?: string,
  infoRows?: EmailInfoRow[],
): string {
  const base = config.mail.appBaseUrl;
  const host = base.replace(/^https?:\/\//, '');
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.65">${p}</p>`).join('');
  const info = infoRows && infoRows.length > 0
    ? `<tr><td style="padding:8px 34px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f6;border:1px solid #e1e8e1;border-radius:10px">${infoRows
        .map(
          (r, i) => `<tr><td style="padding:12px 18px;font-size:13.5px;color:#607d66;${i > 0 ? 'border-top:1px solid #e1e8e1;' : ''}">${escapeHtml(r.label)}</td><td style="padding:12px 18px;font-size:14px;font-weight:700;color:#263238;text-align:right;${i > 0 ? 'border-top:1px solid #e1e8e1;' : ''}">${escapeHtml(r.value)}</td></tr>`,
        )
        .join('')}</table></td></tr>`
    : '';
  const action = actionUrl
    ? `<tr><td align="center" style="padding:20px 34px 26px"><a href="${actionUrl}" style="display:inline-block;background:#f2b33d;color:#263238;font-size:15.5px;font-weight:800;padding:13px 38px;border-radius:10px;text-decoration:none">${actionLabel ?? 'Mở thư viện'}</a><p style="margin:14px 0 0;font-size:12.5px;color:#8a978c;line-height:1.6">Nếu nút không bấm được, hãy mở liên kết: <span style="word-break:break-all">${actionUrl}</span></p></td></tr>`
    : `<tr><td style="padding:0 34px 26px"></td></tr>`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#1b5e20">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(160deg,#1b5e20,#256d2a);background-color:#1b5e20;padding:36px 12px;font-family:'Segoe UI',Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">
<tr><td style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:.3px;padding:0 6px 16px">THƯ VIỆN MINI</td><td style="font-size:12.5px;text-align:right;padding:0 6px 16px"><a href="${base}/" style="color:#eaf5ea;text-decoration:none">${host}</a></td></tr>
</table>
<table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="height:6px;background:#f2b33d;font-size:0;line-height:6px">&nbsp;</td></tr>
<tr><td style="padding:28px 34px 0;color:#263238"><div style="font-size:21px;font-weight:800;color:#1b5e20">${title}</div><div style="margin-top:14px;font-size:15px">${body}</div></td></tr>
${info}
${action}
<tr><td style="background:#f6f8f6;padding:18px 34px;text-align:center;border-top:1px solid #e1e8e1"><div style="font-size:12.5px"><a href="${base}/" style="color:#1b5e20;font-weight:700;text-decoration:none">Trang chủ</a> &nbsp;·&nbsp; <a href="${base}/login" style="color:#1b5e20;font-weight:700;text-decoration:none">Đăng nhập</a> &nbsp;·&nbsp; <a href="${base}/my-books" style="color:#1b5e20;font-weight:700;text-decoration:none">Sách đang mượn</a></div><div style="font-size:12px;color:#8a978c;line-height:1.7;margin-top:8px">Bạn nhận được email này vì địa chỉ của bạn được đăng ký tại Thư viện Mini.<br>© 2026 Thư viện Mini · Email tự động, vui lòng không trả lời.</div></td></tr>
</table>
</td></tr></table>
</body></html>`;
}
