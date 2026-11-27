import { redirect } from "next/navigation";

// Giu URL cu (manifest PWA, proxy va lien ket dang dung); du lieu that o don hang.
export default function Page() {
  redirect("/buyer/orders");
}
