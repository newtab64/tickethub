"use client";

import { useSession } from "@/features/identity";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  organizerOperationsApi,
  operationsError,
} from "../api/organizer-operations-api";
import {
  CreateStaffSchema,
  type CreateStaff,
  type Staff,
} from "../domain/operations";
import {
  Field,
  panelClass,
  QueryMessage,
  selectClass,
} from "./operations-shared";

export function StaffManagement({ eventId }: { eventId: string }) {
  const { user } = useSession();
  const cache = useQueryClient();
  const queryKey = ["organizer", user?.id, eventId, "staff"];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => organizerOperationsApi.staff(eventId, signal),
    retry: false,
  });
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [validation, setValidation] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Staff | null>(null);
  const create = useMutation({
    mutationFn: (input: CreateStaff) =>
      organizerOperationsApi.createStaff(eventId, input),
    onSuccess: async () => {
      setFormOpen(false);
      setNotice("Đã tạo tài khoản và phân công nhân viên.");
      await cache.invalidateQueries({ queryKey });
    },
  });
  const update = useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      gateId?: string;
      status?: "ACTIVE" | "LOCKED";
    }) => organizerOperationsApi.updateStaff(eventId, id, patch),
    onSuccess: async () => {
      setConfirmation(null);
      setNotice("Đã cập nhật nhân viên.");
      await cache.invalidateQueries({ queryKey });
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
              <Field label="Tìm nhân viên">
                <Input
                  className="h-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tên hoặc email"
                />
              </Field>
            </div>
            <Button
              size="lg"
              disabled={!query.data.gates.length}
              onClick={() => {
                setFormOpen(!formOpen);
                create.reset();
                setValidation("");
              }}
            >
              {formOpen ? "Đóng biểu mẫu" : "Thêm nhân viên"}
            </Button>
          </div>
          {!query.data.gates.length && (
            <p role="status" className={panelClass}>
              Sự kiện chưa có cổng vào. Cần thiết lập cổng trước khi phân công
              nhân viên.
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
                    minLength={2}
                    maxLength={100}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    name="email"
                    type="email"
                    required
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
                    aria-describedby="staff-password-help"
                  />
                </Field>
                <Field label="Cổng được phân công">
                  <select
                    name="gateId"
                    required
                    className={selectClass}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Chọn cổng
                    </option>
                    {query.data.gates.map((gate) => (
                      <option key={gate.id} value={gate.id}>
                        {gate.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <p
                id="staff-password-help"
                className="text-xs text-muted-foreground"
              >
                Ít nhất 12 ký tự. Chuyển thông tin đăng nhập qua kênh riêng an
                toàn.
              </p>
              {(validation || create.error) && (
                <p role="alert" className="text-sm text-destructive">
                  {validation || operationsError(create.error)}
                </p>
              )}
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Đang tạo..." : "Tạo và phân công"}
              </Button>
            </form>
          )}
          {update.error && (
            <p role="alert" className="text-sm text-destructive">
              {operationsError(update.error)}
            </p>
          )}
          <div className={`${panelClass} overflow-x-auto`}>
            <table className="w-full text-left text-sm">
              <caption className="text-left font-semibold text-lg mb-5">
                Đội ngũ soát vé ({query.data.items.length})
              </caption>
              <thead className="border-b text-muted-foreground">
                <tr>
                  {["Nhân viên", "Cổng vào", "Trạng thái", "Thao tác"].map(
                    (text) => (
                      <th
                        scope="col"
                        key={text}
                        className="pb-3 pr-4 font-medium"
                      >
                        {text}
                      </th>
                    ),
                  )}
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
                    <td className="py-3 pr-4 min-w-40">
                      <select
                        aria-label={`Cổng của ${staff.fullName}`}
                        className={selectClass}
                        value={staff.gateId || ""}
                        disabled={update.isPending}
                        onChange={(e) => {
                          setNotice("");
                          update.mutate({
                            id: staff.id,
                            gateId: e.target.value,
                          });
                        }}
                      >
                        <option value="" disabled>
                          Chưa phân công
                        </option>
                        {query.data.gates.map((gate) => (
                          <option key={gate.id} value={gate.id}>
                            {gate.name}
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
                  ? "Không tìm thấy nhân viên phù hợp."
                  : "Chưa có nhân viên được phân công."}
              </p>
            )}
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
                Thay đổi quyền đăng nhập và soát vé của tài khoản này.
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
                    if (!confirmation) return;
                    setNotice("");
                    update.mutate({
                      id: confirmation.id,
                      status:
                        confirmation.status === "ACTIVE" ? "LOCKED" : "ACTIVE",
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
