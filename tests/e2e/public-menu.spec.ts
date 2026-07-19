import { expect, test, type Page } from "@playwright/test";
import postgres, { type Sql } from "postgres";

test.describe.configure({ mode: "serial" });

function getAdminCredentials() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL y ADMIN_PASSWORD son obligatorias para las pruebas E2E.",
    );
  }

  return { email, password };
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL es obligatoria para las pruebas E2E.");
  }

  return databaseUrl;
}

async function withDatabase<T>(callback: (sql: Sql) => Promise<T>) {
  const sql = postgres(getDatabaseUrl(), { max: 1 });

  try {
    return await callback(sql);
  } finally {
    await sql.end();
  }
}

async function clearAdminLoginAttempts(email: string) {
  await withDatabase(async (sql) => {
    await sql`
      delete from admin_login_attempts
      where email_normalized = ${email.toLowerCase()}
    `;
  });
}

async function loginAsAdmin(page: Page) {
  const { email, password } = getAdminCredentials();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("public menu works at 320px", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/es$/);
  await expect(
    page.getByRole("heading", { name: "Piccolo La Ràpita", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Cocina con sabor italiano")).toBeVisible();
  await expect(page.getByText("Imagen demo")).toBeVisible();
  await expect(page.getByText(/^(Abierto|Cerrado) ahora$/)).toBeVisible();

  const callButton = page.getByRole("link", {
    name: /llamar al teléfono de demostración/i,
  }).last();
  await expect(callButton).toBeVisible();
  await expect(callButton).toHaveAttribute("href", "tel:+34900000000");

  await page.getByText("Horario de demostración").click();
  await expect(page.getByText("Lunes", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Horario no oficial · solo prototipo"),
  ).toBeVisible();

  const search = page.getByRole("searchbox", {
    name: "Buscar en la carta de demostración",
  });
  await search.fill("VEGETÁRIANO");
  await expect(page.getByTestId("product-card")).toHaveCount(2);

  await search.fill("TAGLIATELLE");
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Tagliatelle de muestra" }),
  ).toBeVisible();

  await search.fill("");
  await page.getByRole("button", { name: "Pizze" }).click();
  await expect(
    page.getByRole("heading", { name: "Pizze", level: 2 }),
  ).toBeInViewport();
  await expect(callButton).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.viewportWidth).toBe(320);
  expect(dimensions.documentWidth).toBeLessThanOrEqual(320);

  await expect(page.getByText(/productos destacados/i)).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath("piccolo-mobile-320.png"),
    fullPage: true,
  });
});

test("admin dashboard loads PostgreSQL metrics at 320px", async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.getByText("Acceso administrativo protegido.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Base de datos conectada")).toBeVisible();

  await expect(page.getByTestId("admin-metric-categories")).toContainText("4");
  await expect(page.getByTestId("admin-metric-products")).toContainText("6");
  await expect(page.getByTestId("admin-metric-languages")).toContainText("1");
  await expect(page.getByTestId("admin-metric-allergens")).toContainText("3");
  await expect(page.getByTestId("admin-metric-tags")).toContainText("5");
  await expect(page.getByText("Sin actividad reciente")).toBeVisible();

  await page
    .getByRole("button", { name: "Abrir menú de administración" })
    .click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByText("Disponible próximamente")).toHaveCount(5);

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.viewportWidth).toBe(320);
  expect(dimensions.documentWidth).toBeLessThanOrEqual(320);
});

test("mobile admin menu opens and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsAdmin(page);

  const sidebar = page.locator("#admin-sidebar");
  const openMenuButton = page.getByRole("button", {
    name: "Abrir menú de administración",
  });

  await expect(sidebar).not.toBeInViewport();
  await openMenuButton.click();
  await expect(sidebar).toBeInViewport();

  await page.getByRole("button", { name: "Cerrar menú", exact: true }).click();
  await expect(sidebar).not.toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Cerrar menú de administración" }),
  ).toHaveClass(/pointer-events-none/);

  await page
    .getByRole("heading", { name: "Dashboard", level: 1 })
    .click();
  await expect(openMenuButton).toBeEnabled();
});

test("unauthenticated admin access redirects to login", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  await expect(
    page.getByRole("heading", { name: "Bienvenido de nuevo", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toHaveCount(0);

  await page.goto("/admin/configuracion");
  await expect(page).toHaveURL(
    /\/login\?next=%2Fadmin%2Fconfiguracion$/,
  );
});

test("incorrect admin credentials show a clear error", async ({ page }) => {
  const { email } = getAdminCredentials();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(
    page.getByRole("alert").filter({
      hasText: "Email o contraseña incorrectos.",
    }),
  ).toHaveText("Email o contraseña incorrectos.");
  await expect(page).toHaveURL(/\/login$/);
});

test("correct admin credentials create a secure session", async ({
  page,
  context,
}) => {
  await loginAsAdmin(page);

  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toBeVisible();

  const sessionCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "piccolo_admin_session",
  );
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");
});

test("logout destroys the session and blocks subsequent access", async ({
  page,
  context,
}) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();

  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === "piccolo_admin_session",
    ),
  ).toBe(false);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
});

test("inactive administrator loses access immediately", async ({
  page,
  context,
}) => {
  const { email } = getAdminCredentials();
  await loginAsAdmin(page);

  try {
    await withDatabase(async (sql) => {
      await sql`
        update admins
        set is_active = false, updated_at = now()
        where email = ${email.toLowerCase()}
      `;
    });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
    expect(
      (await context.cookies()).some(
        (cookie) => cookie.name === "piccolo_admin_session",
      ),
    ).toBe(false);
  } finally {
    await withDatabase(async (sql) => {
      await sql`
        update admins
        set
          is_active = true,
          session_version = session_version + 1,
          updated_at = now()
        where email = ${email.toLowerCase()}
      `;
    });
  }
});

test("session version change invalidates the previous JWT", async ({
  page,
  context,
}) => {
  const { email } = getAdminCredentials();
  await loginAsAdmin(page);

  await withDatabase(async (sql) => {
    await sql`
      update admins
      set session_version = session_version + 1, updated_at = now()
      where email = ${email.toLowerCase()}
    `;
  });

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === "piccolo_admin_session",
    ),
  ).toBe(false);
});

test("five failures block login and a later success clears attempts", async ({
  page,
}) => {
  const { email, password } = getAdminCredentials();
  const normalizedEmail = email.toLowerCase();
  await clearAdminLoginAttempts(normalizedEmail);
  await page.goto("/login");
  const emailInput = page.getByLabel("Email");
  const passwordInput = page.getByLabel("Contraseña");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(emailInput).toHaveValue("");
    await expect(passwordInput).toHaveValue("");
    await emailInput.fill(email);
    await passwordInput.fill("contraseña-incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Email o contraseña incorrectos.",
      }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const [attemptRow] = await withDatabase(async (sql) => {
          return sql<Array<{ failed_attempts: number }>>`
            select failed_attempts
            from admin_login_attempts
            where email_normalized = ${normalizedEmail}
          `;
        });
        return Number(attemptRow?.failed_attempts);
      })
      .toBe(attempt + 1);
    await expect(emailInput).toHaveValue("");
    await expect(passwordInput).toHaveValue("");
  }

  const [blockedAttempt] = await withDatabase(async (sql) => {
    return sql<
      Array<{ failed_attempts: number; blocked_until: Date | null }>
    >`
      select failed_attempts, blocked_until
      from admin_login_attempts
      where email_normalized = ${normalizedEmail}
    `;
  });

  expect(Number(blockedAttempt?.failed_attempts)).toBe(5);
  expect(blockedAttempt?.blocked_until).not.toBeNull();
  expect(new Date(blockedAttempt?.blocked_until ?? 0).getTime()).toBeGreaterThan(
    Date.now(),
  );

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("alert").filter({
      hasText: "Email o contraseña incorrectos.",
    }),
  ).toBeVisible();

  await withDatabase(async (sql) => {
    await sql`
      update admin_login_attempts
      set blocked_until = now() - interval '1 second'
      where email_normalized = ${normalizedEmail}
    `;
  });

  await expect(emailInput).toHaveValue("");
  await expect(passwordInput).toHaveValue("");
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const [remainingAttempts] = await withDatabase(async (sql) => {
    return sql<Array<{ count: number }>>`
      select count(*)::integer as count
      from admin_login_attempts
      where email_normalized = ${normalizedEmail}
    `;
  });
  expect(Number(remainingAttempts?.count)).toBe(0);
});
