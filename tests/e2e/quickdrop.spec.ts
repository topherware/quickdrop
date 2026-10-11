import { test, expect } from "@playwright/test";
// Catch every unconfigured API request before it can reach live Supabase.
// Test-specific routes registered later take precedence over this fallback.
test.beforeEach(async ({ page, request }, testInfo) => {
  // Preserve the existing Indonesian flow checks; new localization checks start fresh in English.
  if (!testInfo.title.startsWith("English default")) {
    await page.addInitScript(() => {
      if (!localStorage.getItem("quickdrop:language"))
        localStorage.setItem("quickdrop:language", "id");
    });
  }
  // Read-only check bypasses browser mocks and fails closed if a live server is used.
  const status = await request.get(
    "/api/transfers/00000000-0000-4000-8000-000000000001/status",
    {
      headers: { Authorization: `Bearer ${"a".repeat(43)}` },
    },
  );
  expect(status.status()).toBe(503);
  expect((await status.json()).error.code).toBe("QD_SETUP");
  await page.route("https://**", (route) => route.abort());
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: { code: "QD_SETUP", message: "Layanan belum dikonfigurasi." },
      },
    }),
  );
});

test("mode survives reload and history; receive route supports keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Terima", exact: true }).click();
  await expect(page).toHaveURL(/mode=receive/);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Terima", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Terima", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("tab", { name: "Kirim", exact: true }),
  ).toBeFocused();
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Terima", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goto("/receive");
  await page.getByRole("tab", { name: "Terima", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await expect(
    page.getByRole("heading", { name: "Kirim file." }),
  ).toBeVisible();
});

test("English default switches to Indonesian without losing files or codes and persists", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your files. Any device.",
  );
  const language = page.getByRole("switch", { name: "Bahasa Indonesia" });
  await expect(language).toHaveAttribute("aria-checked", "false");
  await expect(
    page.getByText("Jarak boleh jauh. File tetap dekat."),
  ).toHaveCount(0);
  await expect(page.locator(".motion-toggle")).toHaveCount(0);
  await page.getByLabel("Choose files to send").setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("sample"),
  });
  await language.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(language).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "File kamu. Lintas perangkat.",
  );
  await expect(
    page.getByRole("button", { name: "Hapus sample.pdf" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buat kode transfer" }),
  ).toBeEnabled();
  await page.getByRole("tab", { name: "Terima", exact: true }).click();
  await page.getByLabel("Kode transfer", { exact: true }).fill("00123456");
  await language.click();
  await expect(page.getByLabel("Transfer code", { exact: true })).toHaveValue(
    "0012 3456",
  );
  await expect(
    page.getByRole("tab", { name: "Receive", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Find files" }).click();
  await expect(page.locator("#receive-error")).toHaveText(
    "The service is not configured yet.",
  );
  await language.click();
  await expect(page.locator("#receive-error")).toHaveText(
    "Layanan belum dikonfigurasi.",
  );
  await page.reload();
  await expect(language).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("tab", { name: "Terima", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const sizes = await page
    .locator("#privacy summary")
    .evaluate((element) => [
      getComputedStyle(element).fontSize,
      getComputedStyle(element.querySelector("span")!).fontSize,
    ]);
  expect(sizes[0]).toBe(sizes[1]);
  await language.click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(language).toHaveAttribute("aria-checked", "false");
});

test("small screens show the initial action and tablet keeps balanced gutters", async ({
  page,
}) => {
  for (const width of [320, 360, 600, 821, 1000, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const panel = document
        .querySelector("#transfer")!
        .getBoundingClientRect();
      const action = document
        .querySelector("#send-panel .primary")!
        .getBoundingClientRect();
      return {
        width: document.documentElement.scrollWidth,
        panelLeft: panel.left,
        panelRight: window.innerWidth - panel.right,
        actionBottom: action.bottom,
      };
    });
    expect(geometry.width).toBeLessThanOrEqual(width);
    if (width <= 360) expect(geometry.actionBottom).toBeLessThanOrEqual(800);
    if (width >= 600 && width <= 1000)
      expect(Math.abs(geometry.panelLeft - geometry.panelRight)).toBeLessThan(
        2,
      );
  }
});

test("English default fits narrow screens and localizes receive results", async ({
  page,
}) => {
  for (const width of [320, 360, 600, 821, 1000, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      actionBottom: document
        .querySelector("#send-panel .primary")!
        .getBoundingClientRect().bottom,
    }));
    expect(geometry.width).toBeLessThanOrEqual(width);
    if (width <= 360) expect(geometry.actionBottom).toBeLessThanOrEqual(800);
  }
  await page.route("**/api/transfers/lookup", (route) =>
    route.fulfill({
      json: {
        transferId: "fixture",
        receiveToken: "a".repeat(43),
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
        serverTime: new Date().toISOString(),
        totalBytes: 1200,
        files: [
          {
            id: "one",
            name: "sample.pdf",
            size: 1200,
            mime: "application/pdf",
          },
        ],
      },
    }),
  );
  await page.getByRole("tab", { name: "Receive", exact: true }).click();
  await page.getByLabel("Transfer code", { exact: true }).fill("00123456");
  await page.getByRole("button", { name: "Find files" }).click();
  await expect(
    page.getByRole("heading", { name: "Shared with you." }),
  ).toBeFocused();
  await expect(page.locator("#receive-feedback")).toHaveText(
    "1 file ready to download.",
  );
  await expect(page.locator(".received-summary")).toContainText(
    "1 file · 1.2 KB",
  );
  await expect(
    page.getByRole("button", { name: "Download sample.pdf" }),
  ).toBeVisible();
  await page.getByLabel("File details: sample.pdf").click();
  await expect(page.getByText("Full name: sample.pdf")).toBeVisible();
  await page.getByRole("switch", { name: "Bahasa Indonesia" }).click();
  await expect(page.locator("#receive-feedback")).toHaveText(
    "1 file siap diunduh.",
  );
  await expect(page.locator(".received-summary")).toContainText(
    "1 file · 1,2 KB",
  );
});

test("simplified copy and one privacy disclosure work on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/");
  for (const removed of [
    /SEDIKIT JARAK/,
    "Langsung antarperangkat",
    "Tanpa akun",
    "Perangkat berbeda. File yang sama.",
    "File siap diunduh tanpa membuat akun.",
  ]) {
    await expect(page.getByText(removed, { exact: true })).toHaveCount(0);
  }
  await expect(
    page.getByRole("region", { name: "Cara berbagi file" }),
  ).toBeVisible();
  await expect(
    page.getByText("Privasi & batas penggunaan", { exact: true }),
  ).toHaveCount(1);
  const disclosure = page.locator("#privacy summary");
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Bagikan dengan sadar." }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator("#privacy")).not.toHaveAttribute("open");
  await page.getByRole("tab", { name: "Terima", exact: true }).click();
  await expect(page.locator(".receive-intro")).toHaveText(
    "Masukkan kode dari perangkat pengirim.",
  );
});

test("timeline repeats without a pause button and reduced motion stays static", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Jeda animasi" })).toHaveCount(
    0,
  );
  await expect(page.locator(".orb-violet")).toHaveCSS(
    "animation-play-state",
    "running",
  );
  const samples = await page.evaluate(() => {
    const timeline = document.querySelector(".how-it-works ol")!;
    const fill = timeline
      .getAnimations({ subtree: true })
      .find(
        (animation) =>
          animation instanceof CSSAnimation &&
          animation.animationName === "timeline-fill",
      )!;
    fill.pause();
    return [0, 4000, 6400, 8000].map((time) => {
      fill.currentTime = time;
      return new DOMMatrix(getComputedStyle(timeline, "::after").transform).a;
    });
  });
  expect(samples[0]).toBe(0);
  expect(samples[1]).toBeGreaterThan(0.5);
  expect(samples[1]).toBeLessThan(1);
  expect(samples[2]).toBe(1);
  expect(samples[3]).toBe(0);
  await expect(page.locator(".orb-violet")).toHaveCSS(
    "animation-play-state",
    "running",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(() => {
    return (
      Array.from(
        document.querySelectorAll(".glass-orb, .prism-ring, .transfer-packet"),
      ).every(
        (element) => getComputedStyle(element).animationName === "none",
      ) &&
      getComputedStyle(document.querySelector(".how-it-works ol")!, "::after")
        .animationName === "none"
    );
  });
  expect(reduced).toBe(true);
  await expect(
    page.getByRole("region", { name: "Cara berbagi file" }),
  ).toBeVisible();
});

test("lookup error returns focus with inline description; long filenames can be disclosed", async ({
  page,
}) => {
  await page.goto("/?mode=receive");
  const input = page.getByLabel("Kode transfer", { exact: true });
  await input.fill("00123456");
  await page.getByRole("button", { name: "Cari file" }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute(
    "aria-describedby",
    "code-help receive-error",
  );
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  const name =
    "project-report-with-a-long-and-shared-prefix-final-approved-version.pdf";
  let finishDownload!: () => void;
  const downloadGate = new Promise<void>((resolve) => {
    finishDownload = resolve;
  });
  await page.route("**/api/transfers/lookup", (route) =>
    route.fulfill({
      json: {
        transferId: "fixture",
        receiveToken: "a".repeat(43),
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
        serverTime: new Date().toISOString(),
        totalBytes: 10,
        files: [{ id: "file", name, size: 10, mime: "application/pdf" }],
      },
    }),
  );
  await page.route("**/api/files/file/download", async (route) => {
    await downloadGate;
    await route.fulfill({
      status: 503,
      json: { error: { code: "PROVIDER", message: "Coba lagi." } },
    });
  });
  await page.getByRole("button", { name: "Cari file" }).click();
  await expect(
    page.getByRole("heading", { name: "File untukmu." }),
  ).toBeFocused();
  await expect(
    page.getByRole("status").filter({ hasText: "1 file siap diunduh." }),
  ).toBeVisible();
  await page.getByLabel("Detail file " + name).click();
  await expect(
    page.getByText("Nama lengkap: " + name, { exact: true }),
  ).toBeVisible();
  const download = page.getByRole("button", {
    name: "Unduh " + name,
    exact: true,
  });
  await download.click();
  await expect(download).toBeDisabled();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Tunggu sebentar sebelum memilih file lain." }),
  ).toBeVisible();
  finishDownload();
  await expect(download).toBeFocused();
  await expect(page.getByRole("tabpanel").getByRole("alert")).toHaveText(
    "Coba lagi.",
  );
  await page.getByRole("button", { name: "Cari transfer lain" }).click();
  await expect(input).toBeFocused();
});

test("unfinished upload clearly requests the original batch", async ({
  page,
}) => {
  const now = new Date().toISOString();
  const init = {
    transferId: "fixture",
    ownerToken: "o".repeat(43),
    uploadDeadline: new Date(Date.now() + 900000).toISOString(),
    serverTime: now,
    targets: [
      {
        id: "file",
        name: "fixture.txt",
        size: 7,
        mime: "text/plain",
        path: "fixture/file",
        signedUrl: "/mock-upload",
      },
    ],
  };
  await page.addInitScript(
    (saved) =>
      sessionStorage.setItem("quickdrop:sender", JSON.stringify(saved)),
    { init, completeKey: "fixture-key" },
  );
  await page.route("**/api/transfers/fixture/status", (route) =>
    route.fulfill({
      json: {
        status: "uploading",
        serverTime: now,
        expiresAt: null,
        uploadDeadline: init.uploadDeadline,
        files: [
          {
            id: "file",
            name: "fixture.txt",
            size: 7,
            mime: "text/plain",
            uploaded: false,
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Pilih ulang batch asli/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Coba lagi" })).toBeDisabled();
});
test("usable mobile UI, keyboard tabs, code normalization", async ({
  page,
}) => {
  if (test.info().project.name === "mobile")
    await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /File kamu/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // Complete an observable React interaction before screenshot caret styling.
  await page.getByRole("tab", { name: "Terima", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Terima", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Kirim", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Kirim", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-home.png`,
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Kirim" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByLabel("Kode transfer", { exact: true }).fill("0012 3456");
  await expect(page.getByLabel("Kode transfer", { exact: true })).toHaveValue(
    "0012 3456",
  );
  await expect(page.getByRole("button", { name: "Cari file" })).toBeEnabled();
});
test("sender uploads, shows QR/code, restores session and revokes using mocked API", async ({
  page,
}) => {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const init = {
    transferId: "fixture",
    ownerToken: "o".repeat(43),
    uploadDeadline: new Date(Date.now() + 900000).toISOString(),
    serverTime: now,
    targets: [
      {
        id: "file",
        path: "fixture/file",
        signedUrl: "http://127.0.0.1:3000/mock-upload",
        name: "fixture.txt",
        mime: "text/plain",
        size: 7,
      },
    ],
  };
  const ready = {
    code: "00123456",
    shareToken: "s".repeat(43),
    expiresAt,
    serverTime: now,
  };
  let completed = false;
  let uploaded = false;
  let revokeCalls = 0;
  let finishRevoke!: () => void;
  const revokeGate = new Promise<void>((resolve) => {
    finishRevoke = resolve;
  });
  await page.route("**/api/transfers", (route) =>
    route.fulfill({ status: 201, json: init }),
  );
  await page.route("**/api/transfers/fixture/status", (route) =>
    route.fulfill({
      json: {
        status: completed ? "ready" : "uploading",
        serverTime: now,
        expiresAt: completed ? expiresAt : null,
        uploadDeadline: init.uploadDeadline,
        files: [
          {
            id: "file",
            name: "fixture.txt",
            size: 7,
            mime: "text/plain",
            uploaded,
          },
        ],
        ready: completed ? ready : undefined,
      },
    }),
  );
  await page.route("**/mock-upload", (route) => {
    uploaded = true;
    return route.fulfill({
      status: 200,
      json: { Key: "transfers/fixture/file" },
    });
  });
  await page.route("**/api/transfers/fixture/complete", (route) => {
    completed = true;
    return route.fulfill({ json: ready });
  });
  await page.route("**/api/transfers/fixture", async (route) => {
    await revokeGate;
    revokeCalls++;
    await route.fulfill(
      revokeCalls === 1
        ? {
            status: 503,
            json: { error: { code: "PROVIDER", message: "Coba lagi." } },
          }
        : { status: 202, json: { status: "revoked" } },
    );
  });
  await page.goto("/");
  await page.getByLabel("Pilih file untuk dikirim").setInputFiles({
    name: "fixture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("fixture"),
  });
  await page.getByRole("button", { name: "Buat kode transfer" }).click();
  await expect(page.getByText("0012 3456", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "File siap dibagikan." }),
  ).toBeFocused();
  await expect(
    page.getByRole("img", { name: /QR untuk membuka transfer/ }),
  ).toBeVisible();
  expect(uploaded).toBe(true);
  await expect(page.getByRole("button", { name: "Salin kode" })).toBeVisible();
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-ready.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByText("0012 3456", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Akhiri transfer", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Akhiri transfer?" }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/redesign/${test.info().project.name}-dialog.png`,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Akhiri transfer", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Akhiri transfer", exact: true })
    .click();
  await page.getByRole("button", { name: "Ya, akhiri" }).click();
  await expect(
    page.getByRole("button", { name: "Mengakhiri transfer…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: "Tunggu sebentar" }),
  ).toBeVisible();
  finishRevoke();
  await expect(page.getByRole("tabpanel").getByRole("alert")).toHaveText(
    "Coba lagi.",
  );
  await expect(
    page.getByRole("button", { name: "Akhiri transfer", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Akhiri transfer", exact: true })
    .click();
  await page.getByRole("button", { name: "Ya, akhiri" }).click();
  await expect(
    page.getByRole("heading", { name: "Transfer diakhiri." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Transfer diakhiri." }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => sessionStorage.getItem("quickdrop:sender")),
  ).toBeNull();
  await page.getByRole("button", { name: "Kirim file lain" }).click();
  await expect(
    page.getByRole("button", { name: /Pilih file untuk dibagikan/ }),
  ).toBeFocused();
});
test("file limits reject whole batch without sending requests", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Pilih file untuk dikirim").setInputFiles(
    Array.from({ length: 6 }, (_, i) => ({
      name: `test${i}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("fixture"),
    })),
  );
  await expect(page.getByRole("tabpanel").getByRole("alert")).toContainText(
    "1–5 file",
  );
  await expect(
    page.getByRole("button", { name: "Buat kode transfer" }),
  ).toBeDisabled();
});
test("mocked unavailable service fails visibly, without fake success", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Pilih file untuk dikirim").setInputFiles({
    name: "fixture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("quickdrop fixture"),
  });
  await page.getByRole("button", { name: "Buat kode transfer" }).click();
  await expect(page.getByRole("tabpanel").getByRole("alert")).toContainText(
    "belum dikonfigurasi",
  );
  await expect(
    page.getByText("KODE TRANSFER", { exact: true }),
  ).not.toBeVisible();
});
test("countdown survives parent renders when a download starts", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-11T08:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-11T08:00:01Z"));
  const now = await page.evaluate(() => Date.now());
  await page.route("**/api/transfers/lookup", (route) =>
    route.fulfill({
      json: {
        transferId: "fixture",
        receiveToken: "a".repeat(43),
        expiresAt: new Date(now + 4000).toISOString(),
        serverTime: new Date(now).toISOString(),
        totalBytes: 10,
        files: [
          { id: "file", name: "fixture.txt", size: 10, mime: "text/plain" },
        ],
      },
    }),
  );
  await page.route("**/api/files/file/download", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "PROVIDER", message: "Coba lagi." } },
    }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Terima", exact: true }).click();
  await page.getByLabel("Kode transfer", { exact: true }).fill("0012 3456");
  await page.getByRole("button", { name: "Cari file" }).click();
  await expect(page.getByText("fixture.txt", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "File untukmu." }),
  ).toBeFocused();
  await page.clock.fastForward(3000);
  await page.getByRole("button", { name: "Unduh fixture.txt" }).click();
  await expect(page.getByRole("tabpanel").getByRole("alert")).toContainText(
    "Coba lagi.",
  );
  await page.clock.fastForward(2000);
  await expect(
    page.getByRole("button", { name: "Unduh fixture.txt" }),
  ).toBeDisabled();
});
test("link token is removed from address bar before exchange", async ({
  page,
}) => {
  await page.goto("/receive#token=" + "a".repeat(43));
  await expect(page).toHaveURL("http://127.0.0.1:3000/receive");
  await expect(page.getByRole("tabpanel").getByRole("alert")).toContainText(
    "belum dikonfigurasi",
  );
});
test("receive file list, attachment request and status use mocked API only", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await page.route("**/api/transfers/lookup", (route) =>
    route.fulfill({
      json: {
        transferId: "fixture",
        receiveToken: "a".repeat(43),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        serverTime: now,
        totalBytes: 10,
        files: [
          { id: "file", name: "fixture.txt", size: 10, mime: "text/plain" },
        ],
      },
    }),
  );
  await page.route("**/api/files/file/download", (route) =>
    route.fulfill({
      json: {
        downloadUrl: "/fixture-download",
        validUntil: new Date(Date.now() + 60000).toISOString(),
      },
    }),
  );
  await page.route("**/fixture-download", (route) =>
    route.fulfill({
      body: "fixture",
      headers: {
        "Content-Disposition": "attachment; filename=fixture.txt",
        "Content-Type": "text/plain",
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Terima", exact: true }).click();
  await page.getByLabel("Kode transfer", { exact: true }).fill("0012 3456");
  await page.getByRole("button", { name: "Cari file" }).click();
  await expect(page.getByText("fixture.txt", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh fixture.txt" }).click();
  expect((await download).suggestedFilename()).toBe("fixture.txt");
  await expect(
    page.getByRole("status").filter({ hasText: "Unduhan dimulai" }),
  ).toBeVisible();
});
