import { expect, test, type Page } from "@playwright/test";

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

  await expect(
    page.getByText(
      "Panel de Administración - Acceso temporal de desarrollo",
    ),
  ).toBeVisible();
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
});

test("incorrect admin credentials show a clear error", async ({ page }) => {
  const { email } = getAdminCredentials();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "Email o contraseña incorrectos.",
  );
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
