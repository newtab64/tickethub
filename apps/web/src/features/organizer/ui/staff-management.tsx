"use client";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/identity";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import {
  organizerOperationsApi as api,
  operationsError,
} from "../api/organizer-operations-api";
import {
  CreateStaffSchema,
  CreateGateSchema,
  type CreateStaff,
  type Staff,
} from "../domain/operations";
import {
  Field,
  panelClass,
  QueryMessage,
  selectClass,
  Pagination,
} from "./operations-shared";
export function StaffManagement({ eventId }: { eventId: string }) {
  const { user } = useSession();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [validation, setValidation] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Staff | null>(null);
  const queryKey = ["organizer", user?.id, eventId, "staff"];
  const query = useQuery({
    queryKey: [...queryKey, page],
    queryFn: ({ signal }) => api.staff(eventId, page, signal),
    retry: false,
  });
  async function invalidate() {
    await cache.invalidateQueries({ queryKey });
    await cache.invalidateQueries({
      queryKey: ["organizer", user?.id, eventId, "gate-monitor"],
    });
  }
  const create = useMutation({
    mutationFn: (input: CreateStaff) => api.createStaff(input),
    onSuccess: async () => {
      setFormOpen(false);
      setNotice(
        "Đã tạo tài khoản. Chọn cổng ở danh sách để phân công vào sự kiện.",
      );
      setPage(1);
      await invalidate();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "LOCKED" }) =>
      api.updateStaff(id, { status }),
    onSuccess: async () => {
      setConfirmation(null);
      setNotice("Đã cập nhật trạng thái tài khoản.");
      await invalidate();
    },
  });
  const assign = useMutation({
    mutationFn: ({ id, gateId }: { id: string; gateId: string }) =>
      gateId ? api.assign(eventId, id, gateId) : api.unassign(eventId, id),
    onSuccess: async () => {
      setNotice("Đã cập nhật phân công sự kiện.");
      await invalidate();
    },
  });
  const gate = useMutation({
    mutationFn: (input: { name: string; locationDesc?: string }) =>
      api.createGate(eventId, input),
    onSuccess: async () => {
      setGateOpen(false);
      setNotice("Đã tạo cổng vào.");
      await invalidate();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice("");
    const result = CreateStaffSchema.safeParse(
      Object.fromEntries(new FormData(e.currentTarget)),
    );
    if (!result.success) {
      setValidation(result.error.issues[0]?.message || "Dữ liệu không hợp lệ");
      return;
    }
    setValidation("");
    create.mutate(result.data);
  }
  function submitGate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = CreateGateSchema.safeParse(
      Object.fromEntries(new FormData(e.currentTarget)),
    );
    if (!result.success) {
      setValidation(result.error.issues[0]?.message || "Dữ liệu không hợp lệ");
      return;
    }
    setValidation("");
    gate.mutate(result.data);
  }
  const items = query.data?.items.filter((staff) =>
    `${staff.fullName} ${staff.email}`
      .toLocaleLowerCase("vi")
      .includes(search.trim().toLocaleLowerCase("vi")),
  );
  return (
    <div className="space-y-5">
      <QueryMessage
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="w-full sm:w-80">
              <Field label="Tìm trên trang nhân viên hiện tại">
                <Input
                  className="h-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tên hoặc email"
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setGateOpen(!gateOpen);
                  setValidation("");
                  gate.reset();
                }}
              >
                Thêm cổng
              </Button>
              <Button
                onClick={() => {
                  setFormOpen(!formOpen);
                  setValidation("");
                  create.reset();
                }}
              >
                {formOpen ? "Đóng biểu mẫu" : "Thêm nhân viên"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Tài khoản thuộc Ban tổ chức, có thể phân công nhiều sự kiện. Khóa
            tài khoản sẽ chặn soát vé trên mọi sự kiện được phân công.
          </p>
          {!query.data.gates.length && (
            <p role="status" className={panelClass}>
              Sự kiện chưa có cổng vào. Tạo cổng trước khi phân công nhân viên.
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-emerald-700">
              {notice}
            </p>
          )}
          {formOpen && (
            <form onSubmit={submit} className={`${panelClass} space-y-5`}>
              <h2 className="text-lg font-semibold">Tạo tài khoản soát vé</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Họ tên">
                  <Input
                    name="fullName"
                    required
                    maxLength={150}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    name="email"
                    type="email"
                    required
                    maxLength={255}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Mật khẩu ban đầu">
                  <Input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Số điện thoại (không bắt buộc)">
                  <Input name="phone" type="tel" maxLength={20} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Mật khẩu ít nhất 12 ký tự. Chuyển thông tin đăng nhập qua kênh
                riêng an toàn.
              </p>
              {(validation || create.error) && (
                <p role="alert" className="text-sm text-destructive">
                  {validation || operationsError(create.error)}
                </p>
              )}
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Đang tạo..." : "Tạo tài khoản"}
              </Button>
            </form>
          )}
          {gateOpen && (
            <form className={`${panelClass} space-y-4`} onSubmit={submitGate}>
              <h2 className="text-lg font-semibold">Tạo cổng vào</h2>
              <Field label="Tên cổng">
                <Input name="name" required maxLength={100} />
              </Field>
              <Field label="Vị trí cổng">
                <Input name="locationDesc" maxLength={255} />
              </Field>
              {(validation || gate.error) && (
                <p role="alert" className="text-destructive text-sm">
                  {validation || operationsError(gate.error)}
                </p>
              )}
              <Button disabled={gate.isPending} type="submit">
                {gate.isPending ? "Đang tạo..." : "Tạo cổng"}
              </Button>
            </form>
          )}
          {(update.error || assign.error) && (
            <p role="alert" className="text-sm text-destructive">
              {operationsError(update.error || assign.error)}
            </p>
          )}
          <div className={`${panelClass} overflow-x-auto`}>
            <table className="w-full text-left text-sm">
              <caption className="text-left font-semibold text-lg mb-5">
                Nhân viên của Ban tổ chức
              </caption>
              <thead className="border-b text-muted-foreground">
                <tr>
                  {[
                    "Nhân viên",
                    "Phân công ở sự kiện này",
                    "Trạng thái",
                    "Thao tác",
                  ].map((text) => (
                    <th
                      key={text}
                      scope="col"
                      className="pb-3 pr-4 font-medium"
                    >
                      {text}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items?.map((staff) => (
                  <tr key={staff.id} className="border-b last:border-0">
                    <td className="py-4 pr-5">
                      <p className="font-medium">{staff.fullName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {staff.email}
                      </p>
                    </td>
                    <td className="py-3 pr-4 min-w-44">
                      <select
                        aria-label={`Cổng của ${staff.fullName}`}
                        className={selectClass}
                        value={staff.gateId || ""}
                        disabled={
                          assign.isPending ||
                          update.isPending ||
                          staff.status === "LOCKED"
                        }
                        onChange={(e) => {
                          setNotice("");
                          assign.mutate({
                            id: staff.id,
                            gateId: e.target.value,
                          });
                        }}
                      >
                        <option value="">Chưa phân công</option>
                        {query.data.gates.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="pr-4 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${staff.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-secondary text-muted-foreground"}`}
                      >
                        {staff.status === "ACTIVE"
                          ? "Đang hoạt động"
                          : "Đã khóa"}
                      </span>
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        disabled={update.isPending}
                        onClick={() => {
                          update.reset();
                          setConfirmation(staff);
                        }}
                      >
                        {staff.status === "ACTIVE"
                          ? "Khóa tài khoản"
                          : "Mở khóa"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items?.length && (
              <p className="py-8 text-sm text-muted-foreground">
                {search
                  ? "Không tìm thấy nhân viên phù hợp trên trang này."
                  : "Chưa có nhân viên trên trang này."}
              </p>
            )}
            <Pagination
              meta={query.data.meta}
              busy={query.isFetching}
              onPage={(p) => {
                setPage(p);
                setSearch("");
              }}
            />
          </div>
          <Dialog
            open={Boolean(confirmation)}
            onOpenChange={(open) => {
              if (!open && !update.isPending) setConfirmation(null);
            }}
          >
            <DialogContent showCloseButton={false}>
              <DialogTitle>
                {confirmation?.status === "ACTIVE" ? "Khóa" : "Mở khóa"} tài
                khoản {confirmation?.fullName}?
              </DialogTitle>
              <DialogDescription>
                Thay đổi áp dụng cho tài khoản trên mọi sự kiện, không chỉ sự
                kiện đang xem.
              </DialogDescription>
              <DialogFooter>
                <Button
                  autoFocus
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() => setConfirmation(null)}
                >
                  Hủy
                </Button>
                <Button
                  disabled={update.isPending}
                  onClick={() => {
                    if (confirmation)
                      update.mutate({
                        id: confirmation.id,
                        status:
                          confirmation.status === "ACTIVE"
                            ? "LOCKED"
                            : "ACTIVE",
                      });
                  }}
                >
                  {update.isPending ? "Đang lưu..." : "Xác nhận"}
                </Button>
              </DialogFooter>
              {update.error && (
                <p role="alert" className="text-sm text-destructive">
                  {operationsError(update.error)}
                </p>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
