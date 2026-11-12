import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUploadUseCases } from "../src/contexts/upload/upload.composition";
import { UploadDomainError } from "../src/contexts/upload/domain/upload.errors";
import {
  hasValidSignature,
  isOwnedImageKey,
  isValidUploadSize,
} from "../src/contexts/upload/domain/image-rules";
import type {
  ObjectStorage,
  StoredObjectInfo,
  VerifiedOrganizerLookup,
} from "../src/contexts/upload/domain/upload.ports";

const PROFILE = "profile-1";
const UUID = "123e4567-e89b-12d3-a456-426614174000";

const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = Uint8Array.from([
  ...Buffer.from("RIFF"),
  0,
  0,
  0,
  0,
  ...Buffer.from("WEBP"),
]);

function fakes(opts: {
  verified?: boolean;
  head?: StoredObjectInfo | null;
  bytes?: Uint8Array | null;
}) {
  const organizers: VerifiedOrganizerLookup = {
    findVerifiedProfileId: async () =>
      opts.verified === false ? null : PROFILE,
  };
  const storage: ObjectStorage = {
    presignPut: async (key) => `https://s3.test/${key}?sig=1`,
    head: async () => opts.head ?? null,
    readRange: async () => opts.bytes ?? null,
    publicUrl: (key) => `https://cdn.test/${key}`,
  };
  return createUploadUseCases({ organizers, storage });
}

async function codeOf(work: Promise<unknown>) {
  try {
    await work;
  } catch (err) {
    assert.ok(err instanceof UploadDomainError);
    return err.code;
  }
  assert.fail("expected UploadDomainError");
}

describe("Upload image domain rules", () => {
  it("validates upload size bounds", () => {
    assert.equal(isValidUploadSize(1), true);
    assert.equal(isValidUploadSize(5 * 1024 * 1024), true);
    assert.equal(isValidUploadSize(5 * 1024 * 1024 + 1), false);
    assert.equal(isValidUploadSize(0), false);
    assert.equal(isValidUploadSize(1.5), false);
  });

  it("only accepts keys inside the organizer folder with a uuid file name", () => {
    assert.equal(
      isOwnedImageKey(PROFILE, `events/${PROFILE}/${UUID}.png`),
      true,
    );
    assert.equal(isOwnedImageKey(PROFILE, `events/other/${UUID}.png`), false);
    assert.equal(isOwnedImageKey(PROFILE, `events/${PROFILE}/../x.png`), false);
    assert.equal(
      isOwnedImageKey(PROFILE, `events/${PROFILE}/${UUID}.gif`),
      false,
    );
  });

  it("checks magic bytes per content type", () => {
    assert.equal(hasValidSignature("image/png", PNG), true);
    assert.equal(hasValidSignature("image/jpeg", JPG), true);
    assert.equal(hasValidSignature("image/webp", WEBP), true);
    assert.equal(hasValidSignature("image/png", JPG), false);
    assert.equal(hasValidSignature("image/webp", PNG), false);
  });
});

describe("Upload use cases", () => {
  it("presigns into the organizer folder with a 5 minute expiry", async () => {
    const res = await fakes({}).presign.execute("u1", {
      contentType: "image/png",
      sizeBytes: 1000,
    } as never);
    assert.match(res.key, new RegExp(`^events/${PROFILE}/.+\\.png$`));
    assert.equal(res.expiresIn, 300);
    assert.equal(res.method, "PUT");
    assert.equal(res.publicUrl, `https://cdn.test/${res.key}`);
  });

  it("rejects presign for unverified organizers and oversize images", async () => {
    assert.equal(
      await codeOf(
        fakes({ verified: false }).presign.execute("u1", {
          contentType: "image/png",
          sizeBytes: 10,
        } as never),
      ),
      "ORGANIZER_NOT_VERIFIED",
    );
    assert.equal(
      await codeOf(
        fakes({}).presign.execute("u1", {
          contentType: "image/png",
          sizeBytes: 6 * 1024 * 1024,
        } as never),
      ),
      "INVALID_IMAGE_SIZE",
    );
  });

  const key = `events/${PROFILE}/${UUID}.png`;

  it("confirms a valid image", async () => {
    const res = await fakes({
      head: { contentLength: 2000, contentType: "image/png" },
      bytes: PNG,
    }).confirm.execute("u1", key);
    assert.equal(res.verified, true);
    assert.equal(res.contentType, "image/png");
    assert.equal(res.sizeBytes, 2000);
  });

  it("rejects keys of other organizers (IDOR) before touching storage", async () => {
    assert.equal(
      await codeOf(fakes({}).confirm.execute("u1", `events/other/${UUID}.png`)),
      "FORBIDDEN_IMAGE_KEY",
    );
  });

  it("maps storage problems to the documented error codes", async () => {
    const cases: Array<[Parameters<typeof fakes>[0], string]> = [
      [{ head: null }, "IMAGE_NOT_FOUND"],
      [
        { head: { contentLength: 0, contentType: "image/png" } },
        "INVALID_IMAGE_SIZE",
      ],
      [
        { head: { contentLength: 8, contentType: "image/png" } },
        "IMAGE_TOO_SMALL",
      ],
      [
        { head: { contentLength: 2000, contentType: "image/jpeg" } },
        "CONTENT_TYPE_MISMATCH",
      ],
      [
        {
          head: { contentLength: 2000, contentType: "image/png" },
          bytes: null,
        },
        "IMAGE_READ_ERROR",
      ],
      [
        { head: { contentLength: 2000, contentType: "image/png" }, bytes: JPG },
        "INVALID_IMAGE_SIGNATURE",
      ],
    ];
    for (const [opts, expected] of cases) {
      assert.equal(
        await codeOf(fakes(opts).confirm.execute("u1", key)),
        expected,
      );
    }
  });
});
