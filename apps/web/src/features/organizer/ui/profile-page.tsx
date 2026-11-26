"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMyOrganizerProfile,
  updateMyOrganizerProfile,
} from "../api/organizer-profile-api";
import { formatDateTimeVi } from "@/shared/lib/format-vi";
import {
  type OrganizerVerificationStatus,
  type OrganizerProfile,
} from "../domain/organizer.types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

function renderStatusBadge(status?: OrganizerVerificationStatus) {
  switch (status) {
    case "VERIFIED":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
          Đã xác minh (VERIFIED)
        </Badge>
      );
    case "REJECTED":
      return <Badge variant="destructive">Bị từ chối (REJECTED)</Badge>;
    default:
      return (
        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
          Đang chờ duyệt (PENDING_VERIFICATION)
        </Badge>
      );
  }
}

interface OrganizerProfileFormProps {
  initialProfile?: OrganizerProfile;
  onSuccess: (updated: OrganizerProfile) => void;
}

function OrganizerProfileForm({
  initialProfile,
  onSuccess,
}: OrganizerProfileFormProps) {
  const [formData, setFormData] = useState({
    organizationName: initialProfile?.organizationName || "",
    taxCode: initialProfile?.taxCode || "",
    representativeName: initialProfile?.representativeName || "",
    phone: initialProfile?.phone || "",
    email: initialProfile?.email || "",
    address: initialProfile?.address || "",
    businessLicenseUrl: initialProfile?.businessLicenseUrl || "",
  });

  const [formError, setFormError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: updateMyOrganizerProfile,
    onSuccess: (updated) => {
      setFormError(null);
      onSuccess(updated);
    },
    onError: (err: Error) => {
      setFormError(
        err.message || "Không thể cập nhật hồ sơ. Vui lòng thử lại sau.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.organizationName.trim();
    const tax = formData.taxCode.trim();
    const phone = formData.phone.trim();
    const rep = formData.representativeName.trim();

    if (!name) {
      setFormError("Vui lòng nhập tên đơn vị / doanh nghiệp tổ chức.");
      return;
    }

    // MST: 10 hoac 13 chu so; CCCD: 12 chu so
    const taxRegex = /^(\d{10}|\d{12}|\d{13})$/;
    if (!tax || !taxRegex.test(tax)) {
      setFormError(
        "Mã số thuế / CCCD không hợp lệ. Vui lòng nhập 10 hoặc 13 số (MST doanh nghiệp) hoặc 12 số (CCCD cá nhân).",
      );
      return;
    }

    if (!rep) {
      setFormError("Vui lòng nhập họ tên người đại diện pháp luật.");
      return;
    }

    // Dinh dang so dien thoai di dong Viet Nam hop le: 03x, 05x, 07x, 08x, 09x hoac +84...
    const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phone || !phoneRegex.test(phone)) {
      setFormError(
        "Số điện thoại liên hệ không hợp lệ. Vui lòng nhập định dạng 0xxxxxxxxx hoặc +84xxxxxxxxx.",
      );
      return;
    }

    updateMutation.mutate({
      organizationName: name,
      taxCode: tax,
      representativeName: rep,
      phone,
      email: formData.email.trim(),
      address: formData.address.trim(),
      businessLicenseUrl: formData.businessLicenseUrl.trim(),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin pháp lý & Liên hệ</CardTitle>
        <CardDescription>
          Cập nhật lần cuối:{" "}
          {initialProfile?.updatedAt
            ? formatDateTimeVi(initialProfile.updatedAt)
            : "Chưa rõ"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {formError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm"
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="organizationName">
                Tên đơn vị / Doanh nghiệp tổ chức *
              </Label>
              <Input
                id="organizationName"
                value={formData.organizationName}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    organizationName: e.target.value,
                  })
                }
                placeholder="VD: Công ty TNHH Giải Trí Sao Việt"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxCode">Mã số thuế / Số CCCD *</Label>
              <Input
                id="taxCode"
                value={formData.taxCode}
                onChange={(e) =>
                  setFormData({ ...formData, taxCode: e.target.value })
                }
                placeholder="10, 12 hoặc 13 chữ số"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="representativeName">
                Người đại diện pháp luật *
              </Label>
              <Input
                id="representativeName"
                value={formData.representativeName}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    representativeName: e.target.value,
                  })
                }
                placeholder="Họ và tên người đại diện"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại liên hệ *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="0901234567"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email nhận thông báo đối soát *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="organizer@tickethub.com"
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Địa chỉ trụ sở chính</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="businessLicenseUrl">
                Liên kết Giấy phép kinh doanh / Tài liệu xác minh (PDF/Ảnh)
              </Label>
              <Input
                id="businessLicenseUrl"
                value={formData.businessLicenseUrl}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    businessLicenseUrl: e.target.value,
                  })
                }
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending
                ? "Đang xử lý..."
                : initialProfile?.status === "REJECTED"
                  ? "Cập nhật & Gửi duyệt lại"
                  : "Lưu hồ sơ & Gửi xác minh"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function OrganizerProfilePage() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["myOrganizerProfile"],
    queryFn: getMyOrganizerProfile,
  });

  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleProfileSuccess = (updated: OrganizerProfile) => {
    queryClient.setQueryData(["myOrganizerProfile"], updated);
    setSavedMessage("Đã lưu hồ sơ và gửi yêu cầu xét duyệt thành công!");
    setTimeout(() => setSavedMessage(null), 4000);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hồ sơ Ban tổ chức
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cung cấp thông tin pháp lý để Admin phê duyệt quyền mở bán sự kiện
            trên tickethub.
          </p>
        </div>
        <div>{renderStatusBadge(profile?.status)}</div>
      </div>

      {profile?.status === "REJECTED" && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm space-y-1"
        >
          <div className="font-semibold">
            Hồ sơ của bạn bị từ chối phê duyệt
          </div>
          <div>
            <strong>Lý do từ Admin:</strong>{" "}
            {profile.rejectionReason ||
              "Thông tin giấy phép kinh doanh hoặc mã số thuế chưa hợp lệ."}
          </div>
          <div className="text-xs pt-1 opacity-90">
            Vui lòng cập nhật lại thông tin chính xác bên dưới và bấm &quot;Gửi
            duyệt lại&quot;.
          </div>
        </div>
      )}

      {profile?.status === "VERIFIED" && (
        <div
          role="status"
          className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm"
        >
          Hồ sơ Ban tổ chức đã được xác minh hợp lệ. Bạn có toàn quyền tạo và
          gửi xuất bản sự kiện mới.
        </div>
      )}

      {savedMessage && (
        <div
          role="status"
          className="p-3 rounded-md bg-primary/10 border border-primary/20 text-primary text-sm font-medium"
        >
          {savedMessage}
        </div>
      )}

      <OrganizerProfileForm
        key={profile?.id || "profile-form"}
        initialProfile={profile}
        onSuccess={handleProfileSuccess}
      />
    </div>
  );
}
