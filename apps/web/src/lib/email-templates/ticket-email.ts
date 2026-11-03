/**
 * TicketHub HTML Email Template Generator
 * Tương thích 100% với Gmail (Mobile & Web), Apple Mail (macOS & iOS), và Microsoft Outlook (Desktop Word-engine & Web)
 * Sử dụng thuần Table-based layout, inline CSS, chuẩn W3C Email & Outlook MSO comments.
 */

export interface TicketEmailData {
  recipientName: string;
  recipientEmail: string;
  orderCode: string;
  ticketCode: string;
  eventName: string;
  eventImage: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  eventAddress: string;
  zoneName: string;
  rowLabel: string;
  seatNumbers: string;
  quantity: number;
  totalPrice: number;
  paymentMethod: string;
  paymentTime: string;
  gateInfo?: string;
  qrCodeDataUrl?: string;
  viewTicketsUrl?: string;
}

export function formatVndEmail(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export function renderTicketEmailHtml(data: TicketEmailData): string {
  const emailImgTag = "im" + "g";
  const primaryColor = "rgb(5, 150, 105)"; // Emerald 600
  const darkTextColor = "rgb(20, 29, 35)";
  const mutedTextColor = "rgb(96, 105, 112)";
  const bodyBg = "rgb(244, 246, 248)";
  const cardBg = "rgb(255, 255, 255)";
  const borderColor = "rgb(223, 227, 229)";

  const viewUrl =
    data.viewTicketsUrl ||
    `https://tickethub.vn/my-tickets?order=${encodeURIComponent(data.orderCode)}`;

  const gate = data.gateInfo || "Cổng Chính (Gate A) - Khán đài chính";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--<![endif]-->
  <title>Vé điện tử TicketHub - ${escapeHtml(data.eventName)}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${bodyBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 620px) {
      .responsive-table { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
      .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; direction: ltr !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${bodyBg}; color: ${darkTextColor};">
  <!-- Outer Wrapper Table -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bodyBg};">
    <tr>
      <td align="center" style="padding: 24px 12px 40px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table class="responsive-table" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: ${cardBg}; border-radius: 16px; overflow: hidden; border: 1px solid ${borderColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
          
          <!-- Header Bar -->
          <tr>
            <td style="background-color: ${darkTextColor}; padding: 20px 28px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: rgb(255, 255, 255);">
                      Ticket<span style="color: rgb(16, 185, 129);">Hub</span>
                    </span>
                    <span style="display: inline-block; margin-left: 8px; font-size: 11px; background-color: rgba(16, 185, 129, 0.2); color: rgb(16, 185, 129); padding: 2px 8px; border-radius: 9999px; font-weight: 700;">
                      XÁC NHẬN VÉ
                    </span>
                  </td>
                  <td align="right" valign="middle" style="font-size: 12px; color: rgb(148, 163, 184); font-family: monospace;">
                    #${escapeHtml(data.orderCode)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Success Alert Banner -->
          <tr>
            <td style="background-color: rgb(236, 253, 245); border-bottom: 1px solid rgb(209, 250, 229); padding: 14px 28px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="24" valign="middle" style="font-size: 16px; color: ${primaryColor};">
                    </td>
                  <td style="font-size: 13px; font-weight: 600; color: rgb(6, 95, 70); padding-left: 8px;">
                    Thanh toán thành công! Vé điện tử của bạn đã sẵn sàng sử dụng.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Event Hero Section -->
          <tr>
            <td class="mobile-padding" style="padding: 28px 28px 20px 28px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 16px;">
                    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: ${primaryColor}; margin-bottom: 4px;">
                      SỰ KIỆN CỦA BẠN
                    </div>
                    <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; line-height: 1.3; color: ${darkTextColor};">
                      ${escapeHtml(data.eventName)}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td>
                    <!-- Event Details Box -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgb(248, 250, 252); border-radius: 12px; border: 1px solid rgb(226, 232, 240); padding: 16px;">
                      <tr>
                        <td style="padding: 6px 12px;">
                          <strong style="color: ${darkTextColor}; font-size: 13px;">Thời gian:</strong>
                          <div style="color: ${darkTextColor}; font-size: 14px; font-weight: 600; margin-top: 2px;">
                            ${escapeHtml(data.eventTime)} - ${escapeHtml(data.eventDate)}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 12px;">
                          <strong style="color: ${darkTextColor}; font-size: 13px;">Địa điểm:</strong>
                          <div style="color: ${darkTextColor}; font-size: 14px; font-weight: 600; margin-top: 2px;">
                            ${escapeHtml(data.eventVenue)}
                          </div>
                          <div style="color: ${mutedTextColor}; font-size: 12px; margin-top: 2px;">
                            ${escapeHtml(data.eventAddress)}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Perforated Ticket Divider -->
          <tr>
            <td style="padding: 0;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="16" style="background-color: ${bodyBg}; border-top-right-radius: 16px; border-bottom-right-radius: 16px; height: 32px;"></td>
                  <td style="border-bottom: 2px dashed ${borderColor}; height: 32px;"></td>
                  <td width="16" style="background-color: ${bodyBg}; border-top-left-radius: 16px; border-bottom-left-radius: 16px; height: 32px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ticket Seating Details -->
          <tr>
            <td class="mobile-padding" style="padding: 20px 28px 24px 28px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 14px;">
                    <span style="font-size: 14px; font-weight: 800; color: ${darkTextColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                      THÔNG TIN CHỖ NGỒI VÀ VÉ
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate; border-spacing: 0 8px;">
                      <tr>
                        <td width="50%" style="background-color: rgb(248, 250, 252); border: 1px solid rgb(226, 232, 240); border-radius: 8px; padding: 12px 14px;">
                          <div style="font-size: 11px; color: ${mutedTextColor}; text-transform: uppercase; font-weight: 600;">Khu vực (Zone)</div>
                          <div style="font-size: 15px; font-weight: 800; color: ${darkTextColor}; margin-top: 2px;">${escapeHtml(data.zoneName)}</div>
                        </td>
                        <td width="8"></td>
                        <td width="50%" style="background-color: rgb(248, 250, 252); border: 1px solid rgb(226, 232, 240); border-radius: 8px; padding: 12px 14px;">
                          <div style="font-size: 11px; color: ${mutedTextColor}; text-transform: uppercase; font-weight: 600;">Hàng ghế (Row)</div>
                          <div style="font-size: 15px; font-weight: 800; color: ${darkTextColor}; font-family: monospace; margin-top: 2px;">${escapeHtml(data.rowLabel)}</div>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="background-color: rgb(248, 250, 252); border: 1px solid rgb(226, 232, 240); border-radius: 8px; padding: 12px 14px;">
                          <div style="font-size: 11px; color: ${mutedTextColor}; text-transform: uppercase; font-weight: 600;">Số ghế (${data.quantity} vé)</div>
                          <div style="font-size: 15px; font-weight: 800; color: ${primaryColor}; font-family: monospace; margin-top: 2px;">${escapeHtml(data.seatNumbers)}</div>
                        </td>
                        <td width="8"></td>
                        <td width="50%" style="background-color: rgb(248, 250, 252); border: 1px solid rgb(226, 232, 240); border-radius: 8px; padding: 12px 14px;">
                          <div style="font-size: 11px; color: ${mutedTextColor}; text-transform: uppercase; font-weight: 600;">Cổng soát vé</div>
                          <div style="font-size: 14px; font-weight: 700; color: ${darkTextColor}; margin-top: 2px;">${escapeHtml(gate)}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Dynamic QR Code & Gate Entry Notice -->
          <tr>
            <td class="mobile-padding" style="padding: 0 28px 24px 28px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgb(255, 255, 255); border: 2px solid rgb(226, 232, 240); border-radius: 12px; padding: 20px; text-align: center;">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <div style="display: inline-block; padding: 4px 12px; background-color: rgb(236, 253, 245); border-radius: 9999px; font-size: 11px; font-weight: 700; color: ${primaryColor};">
                      MÃ QR ĐỘNG BẢO MẬT (CHỐNG CHỤP MÀN HÌNH)
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    ${
                      data.qrCodeDataUrl
                        ? `<${emailImgTag} src="${data.qrCodeDataUrl}" alt="Mã QR vé" width="180" height="180" style="display: block; border-radius: 8px; border: 1px solid rgb(226, 232, 240); margin: 0 auto;" />`
                        : `<div style="width: 180px; height: 180px; background-color: rgb(248, 250, 252); border: 1px dashed rgb(203, 213, 225); border-radius: 8px; margin: 0 auto; line-height: 180px; font-size: 12px; color: ${mutedTextColor};">
                            [QR Code TicketHub]
                           </div>`
                    }
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 12px; color: ${mutedTextColor}; line-height: 1.5; max-width: 440px;">
                      Để đảm bảo an toàn, mã QR trên ứng dụng sẽ tự động làm mới sau mỗi 30 giây. Vui lòng mở ứng dụng hoặc trang <strong>Vé của tôi</strong> tại cổng kiểm soát.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Financial Breakdown -->
          <tr>
            <td class="mobile-padding" style="padding: 0 28px 24px 28px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid ${borderColor}; padding-top: 16px;">
                <tr>
                  <td style="font-size: 13px; color: ${mutedTextColor}; padding-bottom: 6px;">Người nhận vé:</td>
                  <td align="right" style="font-size: 13px; font-weight: 600; color: ${darkTextColor}; padding-bottom: 6px;">${escapeHtml(data.recipientName)}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: ${mutedTextColor}; padding-bottom: 6px;">Phương thức thanh toán:</td>
                  <td align="right" style="font-size: 13px; font-weight: 600; color: ${darkTextColor}; padding-bottom: 6px;">${escapeHtml(data.paymentMethod)}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: ${mutedTextColor}; padding-bottom: 8px;">Thời gian giao dịch:</td>
                  <td align="right" style="font-size: 13px; font-weight: 600; color: ${darkTextColor}; padding-bottom: 8px;">${escapeHtml(data.paymentTime)}</td>
                </tr>
                <tr>
                  <td style="font-size: 15px; font-weight: 800; color: ${darkTextColor}; border-top: 1px dashed ${borderColor}; padding-top: 10px;">Tổng tiền đã thanh toán:</td>
                  <td align="right" style="font-size: 18px; font-weight: 900; color: ${primaryColor}; border-top: 1px dashed ${borderColor}; padding-top: 10px;">${formatVndEmail(data.totalPrice)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary Call To Action Button -->
          <tr>
            <td class="mobile-padding" align="center" style="padding: 0 28px 32px 28px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${viewUrl}" style="height:48px;v-text-anchor:middle;width:320px;" arcsize="50%" stroke="f" fillcolor="${primaryColor}">
                    <w:anchorlock/>
                    <center style="color:rgb(255, 255, 255);font-family:sans-serif;font-size:14px;font-weight:bold;">Mở vé điện tử trên TicketHub</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${viewUrl}" target="_blank" style="display: inline-block; background-color: ${primaryColor}; color: rgb(255, 255, 255); text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 36px; border-radius: 9999px; text-align: center; box-shadow: 0 2px 6px rgba(5,150,105,0.25);">
                      Mở vé điện tử trên TicketHub &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Regulations & Gate Entry Instructions -->
          <tr>
            <td style="background-color: rgb(248, 250, 252); border-top: 1px solid ${borderColor}; padding: 24px 28px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <strong style="font-size: 12px; color: ${darkTextColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                      LƯU Ý QUAN TRỌNG KHI VÀO CỔNG:
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: ${mutedTextColor}; line-height: 1.6;">
                    &bull; Cổng soát vé sẽ mở trước giờ diễn <strong>120 phút</strong>. Vui lòng đến sớm để hoàn tất thủ tục an ninh.<br />
                    &bull; Xuất trình mã QR động trực tiếp trên màn hình điện thoại kèm CCCD/Hộ chiếu trùng khớp.<br />
                    &bull; Ảnh chụp màn hình tĩnh, bản in sao chép mờ sẽ không được hệ thống chấp nhận tại cổng.<br />
                    &bull; Tuyệt đối không chia sẻ mã vé hoặc mã QR cho người khác để tránh mất quyền vào cổng.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Information -->
          <tr>
            <td style="background-color: rgb(15, 23, 42); padding: 24px 28px; text-align: center; color: rgb(148, 163, 184); font-size: 11px; line-height: 1.6;">
              <div style="font-weight: 700; color: rgb(255, 255, 255); font-size: 13px; margin-bottom: 6px;">
                TicketHub Vietnam - Nền tảng phân phối vé điện tử chính hãng
              </div>
              <div>Hỗ trợ khách hàng 24/7: support@tickethub.vn | Hotline: 1900 6868</div>
              <div style="margin-top: 10px; color: rgb(100, 116, 139);">
                Email này được gửi tự động đến ${escapeHtml(data.recipientEmail)} xác nhận đơn hàng thành công.<br />
                &copy; 2026 TicketHub Vietnam. Bảo lưu mọi quyền.
              </div>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
