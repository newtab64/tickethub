import { expect, type APIRequestContext } from "@playwright/test";
import { createHmac } from "node:crypto";
import { VnpayPaymentResponseSchema } from "@tickethub/shared";

/** Xác nhận đơn bằng IPN cục bộ, ký bằng khóa thử nghiệm của API riêng. */
export async function payByLocalIpn(
  request: APIRequestContext,
  api: string,
  headers: Record<string, string>,
  orderId: string,
) {
  const payment = VnpayPaymentResponseSchema.parse(
    (
      await (
        await request.post(`${api}/payments/orders/${orderId}/vnpay`, {
          headers,
        })
      ).json()
    ).data,
  );
  const params = new URLSearchParams({
    vnp_TmnCode: process.env.W04_VNPAY_TEST_TMN || "W04LOCALTEST",
    vnp_TxnRef: payment.transactionRef,
    vnp_Amount: String(payment.amountVnd * 100),
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: String(Date.now()),
    vnp_PayDate: "20261105220000",
  });
  params.sort();
  const signature = createHmac(
    "sha512",
    process.env.W04_VNPAY_TEST_SECRET || "w04-local-signature-fixture-only",
  )
    .update(params.toString())
    .digest("hex");
  params.set("vnp_SecureHash", signature);
  const ipn = await request.get(`${api}/payments/vnpay/ipn?${params}`);
  expect((await ipn.json()).RspCode).toBe("00");
}
