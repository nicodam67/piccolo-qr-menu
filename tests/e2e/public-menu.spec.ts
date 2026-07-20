import { expect, test, type Page } from "@playwright/test";
import { rm } from "node:fs/promises";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import sharp from "sharp";

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

async function cleanupE2ECategories() {
  await withDatabase(async (sql) => {
    await sql.begin(async (transaction) => {
      await transaction`
        delete from categories
        where id in (
          select category_id
          from category_translations
          where name like 'Categoría E2E%'
        )
      `;
      await transaction`
        with ordered as (
          select
            id,
            row_number() over (order by sort_order, id)::integer as next_order
          from categories
        )
        update categories
        set sort_order = ordered.next_order, updated_at = now()
        from ordered
        where categories.id = ordered.id
      `;
    });
  });
}

async function cleanupE2EProducts() {
  const managedImageUrls = await withDatabase(async (sql) => {
    return sql.begin(async (transaction) => {
      const imageRows = await transaction<Array<{ image_url: string }>>`
        select products.image_url
        from products
        inner join product_translations
          on product_translations.product_id = products.id
        where product_translations.name like 'Producto E2E%'
      `;
      await transaction`
        delete from products
        where id in (
          select product_id
          from product_translations
          where name like 'Producto E2E%'
        )
      `;
      await transaction`
        with ordered as (
          select
            id,
            row_number() over (
              partition by category_id
              order by sort_order, id
            )::integer as next_order
          from products
        )
        update products
        set sort_order = ordered.next_order, updated_at = now()
        from ordered
        where products.id = ordered.id
      `;
      return imageRows.map(({ image_url }) => image_url);
    });
  });

  await Promise.all(
    managedImageUrls.flatMap((url) => {
      if (!url.startsWith("/uploads/products/")) {
        return [];
      }

      const desktopFile = path.basename(url);
      const mobileFile = desktopFile.replace(
        /\.desktop\.webp$/,
        ".mobile.webp",
      );
      const directory = path.resolve(
        process.cwd(),
        process.env.IMAGE_LOCAL_DIRECTORY ?? ".data/uploads",
        "products",
      );

      return [
        rm(path.join(directory, desktopFile), { force: true }),
        rm(path.join(directory, mobileFile), { force: true }),
      ];
    }),
  );
}

async function cleanupE2ETaxonomies() {
  await withDatabase(async (sql) => {
    await sql.begin(async (transaction) => {
      await transaction`
        delete from allergens
        where id in (
          select allergen_id
          from allergen_translations
          where name like 'Alérgeno E2E%'
        )
      `;
      await transaction`
        delete from tags
        where id in (
          select tag_id
          from tag_translations
          where name like 'Etiqueta E2E%'
        )
      `;
      await transaction`
        with ordered as (
          select
            id,
            row_number() over (order by sort_order, id)::integer as next_order
          from allergens
        )
        update allergens
        set sort_order = ordered.next_order
        from ordered
        where allergens.id = ordered.id
      `;
      await transaction`
        with ordered as (
          select
            id,
            row_number() over (order by sort_order, id)::integer as next_order
          from tags
        )
        update tags
        set sort_order = ordered.next_order
        from ordered
        where tags.id = ordered.id
      `;
      await transaction`
        update tags
        set is_active = true
        where id in (
          select tag_id from tag_translations where name = 'Vegetariano'
        )
      `;
      await transaction`
        update allergens
        set is_active = true
        where id in (
          select allergen_id from allergen_translations where name = 'Leche'
        )
      `;
    });
  });
}

type BrandingBackup = {
  restaurantId: string;
  name: string;
  slogan: string;
  phone: string;
  tuesdayFirstOpensAt: string;
};

let brandingBackup: BrandingBackup | null = null;
let menuSettingsBackup: unknown;
let menuSettingsBackupCaptured = false;

async function captureBrandingBackup() {
  const [backup] = await withDatabase(async (sql) => {
    return sql<Array<BrandingBackup>>`
      select
        restaurant_settings.id as "restaurantId",
        restaurant_translations.name,
        restaurant_translations.slogan,
        restaurant_settings.phone,
        to_char(opening_hours.first_opens_at, 'HH24:MI') as "tuesdayFirstOpensAt"
      from restaurant_settings
      inner join restaurant_translations
        on restaurant_translations.restaurant_id = restaurant_settings.id
        and restaurant_translations.locale = 'es'
      inner join opening_hours
        on opening_hours.restaurant_id = restaurant_settings.id
        and opening_hours.day_of_week = 2
      limit 1
    `;
  });

  if (!backup) {
    throw new Error("No se pudo respaldar el branding para la prueba.");
  }

  brandingBackup = backup;
  return backup;
}

async function restoreBrandingBackup() {
  const backup = brandingBackup;

  if (!backup) {
    return;
  }

  await withDatabase(async (sql) => {
    await sql.begin(async (transaction) => {
      await transaction`
        update restaurant_settings
        set phone = ${backup.phone}, updated_at = now()
        where id = ${backup.restaurantId}
      `;
      await transaction`
        update restaurant_translations
        set
          name = ${backup.name},
          slogan = ${backup.slogan}
        where restaurant_id = ${backup.restaurantId}
          and locale = 'es'
      `;
      await transaction`
        update opening_hours
        set first_opens_at = ${backup.tuesdayFirstOpensAt}
        where restaurant_id = ${backup.restaurantId}
          and day_of_week = 2
      `;
    });
  });
}

async function captureMenuSettingsBackup() {
  const [row] = await withDatabase(async (sql) => {
    return sql<Array<{ menu_display_settings: unknown }>>`
      select menu_display_settings
      from restaurant_settings
      limit 1
    `;
  });

  if (!row) {
    throw new Error("No se pudo respaldar la configuración de la carta.");
  }

  menuSettingsBackup = row.menu_display_settings;
  menuSettingsBackupCaptured = true;
}

async function restoreMenuSettingsBackup() {
  if (!menuSettingsBackupCaptured) {
    return;
  }

  await withDatabase(async (sql) => {
    if (menuSettingsBackup === null) {
      await sql`
        update restaurant_settings
        set menu_display_settings = null, updated_at = now()
      `;
    } else {
      await sql`
        update restaurant_settings
        set
          menu_display_settings = ${JSON.stringify(menuSettingsBackup)}::jsonb,
          updated_at = now()
      `;
    }
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
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|did not match|server rendered html/i.test(message.text())
    ) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydration|did not match/i.test(error.message)) {
      hydrationErrors.push(error.message);
    }
  });
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
    name: "Buscar platos en la carta",
  });
  await expect(search).toHaveAttribute("placeholder", "Buscar platos...");
  await expect(
    page.getByRole("button", { name: "Antipasti · 2" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Pizze · 2" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pasta · 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dolci · 1" })).toBeVisible();
  await search.fill("BURRÁTA");
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Antipasti · 1" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Pizze/ })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Burrata de muestra", level: 3 }),
  ).toBeVisible();

  await search.fill("SALSA ILUSTRÁTIVAS");
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Tagliatelle de muestra" }),
  ).toBeVisible();

  await search.fill("producto que no existe");
  await expect(page.getByTestId("product-card")).toHaveCount(0);
  await expect(
    page.getByText("No encontramos ningún plato"),
  ).toBeVisible();
  await page.getByText("Borrar búsqueda", { exact: true }).click();
  await expect(page.getByTestId("product-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Pizze" }).click();
  await expect(
    page.getByRole("heading", { name: "Pizze", level: 2 }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Pizze · 2" }),
  ).toHaveAttribute("aria-current", "page");
  await page.waitForTimeout(600);
  await page
    .getByRole("heading", { name: "Dolci", level: 2 })
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "auto" }),
    );
  await expect(
    page.getByRole("button", { name: "Dolci · 1" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(callButton).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.viewportWidth).toBe(320);
  expect(dimensions.documentWidth).toBeLessThanOrEqual(320);

  await expect(page.getByText(/productos destacados/i)).toHaveCount(0);
  expect(hydrationErrors).toEqual([]);

  await page.screenshot({
    path: testInfo.outputPath("piccolo-mobile-320.png"),
    fullPage: true,
  });
});

test("public menu restores its recent position in the same session", async ({
  page,
}) => {
  await page.goto("/es");
  await page
    .getByRole("heading", { name: "Pasta", level: 2 })
    .evaluate((element) =>
      element.scrollIntoView({ block: "start", behavior: "auto" }),
    );
  await expect(
    page.getByRole("button", { name: "Pasta · 1" }),
  ).toHaveAttribute("aria-current", "page");
  const previousScrollY = await page.evaluate(() => window.scrollY);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const value = sessionStorage.getItem("piccolo-menu-position:es");
        return value ? (JSON.parse(value) as { scrollY: number }).scrollY : 0;
      }),
    )
    .toBeGreaterThan(0);

  await page.goto("/login");
  await page.goBack();
  await expect(page).toHaveURL(/\/es$/);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThanOrEqual(Math.max(0, previousScrollY - 120));
  await expect(
    page.getByRole("button", { name: "Pasta · 1" }),
  ).toHaveAttribute("aria-current", "page");
});

test("public menu remains responsive across supported viewports", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1_024 },
    { width: 1_280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/es");
    await expect(
      page.getByRole("searchbox", { name: "Buscar platos en la carta" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Categorías de la carta" }),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(
      dimensions.viewportWidth,
    );
  }
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
  await expect(page.getByText("Disponible próximamente")).toHaveCount(2);

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

test("administrator manages categories without changing the schema", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await cleanupE2ECategories();
  await loginAsAdmin(page);
  await page.goto("/admin/categories");

  await expect(
    page.getByRole("heading", { name: "Categorías", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Antipasti", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await page.getByLabel("Nombre").fill(" Categoría E2E");
  await page
    .getByLabel("Descripción")
    .fill("Categoría creada por la prueba de administración.");
  await page.getByRole("button", { name: "Crear categoría" }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "El nombre no puede empezar ni terminar con espacios.",
    }),
  ).toHaveText("El nombre no puede empezar ni terminar con espacios.");

  await page.getByLabel("Nombre").fill("Categoría E2E");
  await page.getByRole("button", { name: "Crear categoría" }).click();
  await expect(
    page.getByRole("heading", { name: "Categoría E2E", level: 3 }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Editar Categoría E2E" })
    .click();
  await page.getByLabel("Nombre").fill("Categoría E2E actualizada");
  await page
    .getByLabel("Descripción")
    .fill("Descripción actualizada desde PostgreSQL.");
  await page.getByLabel("Visible").uncheck();
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  const testCategoryRow = page
    .getByTestId(/^category-row-/)
    .filter({ hasText: "Categoría E2E actualizada" });
  await expect(testCategoryRow).toContainText("No visible");
  await testCategoryRow
    .getByRole("button", { name: "Mostrar Categoría E2E actualizada" })
    .click();
  await expect(
    testCategoryRow.getByRole("button", {
      name: "Ocultar Categoría E2E actualizada",
    }),
  ).toBeVisible();

  const targetCategoryRow = page
    .getByTestId(/^category-row-/)
    .filter({ hasText: "Antipasti" });
  const sourceHandle = testCategoryRow.getByRole("button", {
    name: "Reordenar Categoría E2E actualizada",
  });
  const targetHandle = targetCategoryRow.getByRole("button", {
    name: "Reordenar Antipasti",
  });
  await expect(testCategoryRow).toBeVisible();
  await expect(targetCategoryRow).toBeVisible();
  await expect(sourceHandle).toBeVisible();
  await expect(sourceHandle).toBeEnabled();
  await expect(targetHandle).toBeVisible();
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("No se pudieron calcular las posiciones del drag & drop.");
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + 4,
    { steps: 20 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => {
      const [categoryOrder] = await withDatabase(async (sql) => {
        return sql<Array<{ sort_order: number }>>`
          select categories.sort_order
          from categories
          inner join category_translations
            on category_translations.category_id = categories.id
          where category_translations.name = 'Categoría E2E actualizada'
        `;
      });
      return Number(categoryOrder?.sort_order);
    })
    .toBe(1);
  await expect(testCategoryRow).toContainText("Orden 1");

  await page.getByRole("button", { name: "Eliminar Antipasti" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(
    page.getByText(/No se puede eliminar: tiene 2 productos/),
  ).toBeVisible();
  await expect(page.getByText("Antipasti", { exact: true })).toBeVisible();

  await testCategoryRow
    .getByRole("button", { name: "Eliminar Categoría E2E actualizada" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Categoría E2E actualizada",
      level: 3,
    }),
  ).toHaveCount(0);
});

test("administrator manages allergens and protects associated items", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await cleanupE2ETaxonomies();
  await loginAsAdmin(page);
  await page.goto("/admin/allergens");

  const search = page.getByPlaceholder("Buscar alérgenos…");
  await search.fill("gluten");
  await expect(page.getByText("Gluten", { exact: true })).toBeVisible();
  await expect(page.getByText("Huevo", { exact: true })).toHaveCount(0);
  await search.fill("");

  await page.getByRole("button", { name: "Nuevo alérgeno" }).click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill(" Alérgeno E2E");
  await page.getByLabel("Código").fill("allergen_e2e");
  await page.getByLabel("Icono").fill("fish");
  await page.getByRole("button", { name: "Crear alérgeno" }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "El nombre no puede empezar ni terminar con espacios.",
    }),
  ).toBeVisible();

  await page.getByLabel("Nombre", { exact: true }).fill("Alérgeno E2E");
  await page.getByRole("button", { name: "Crear alérgeno" }).click();
  await page.getByRole("button", { name: "Editar Alérgeno E2E" }).click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Alérgeno E2E actualizado");
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  const allergenRow = page
    .getByTestId(/^allergen-row-/)
    .filter({ hasText: "Alérgeno E2E actualizado" });
  await allergenRow
    .getByRole("button", { name: "Desactivar Alérgeno E2E actualizado" })
    .click();
  await expect(allergenRow).toContainText("Inactivo");
  await allergenRow
    .getByRole("button", { name: "Activar Alérgeno E2E actualizado" })
    .click();

  const sourceHandle = allergenRow.getByRole("button", {
    name: "Reordenar Alérgeno E2E actualizado",
  });
  const targetHandle = page.getByRole("button", {
    name: "Reordenar Gluten",
  });
  await expect(sourceHandle).toBeEnabled();
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("No se pudo arrastrar el alérgeno.");
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + 4,
    { steps: 20 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => {
      const [order] = await withDatabase(async (sql) => {
        return sql<Array<{ sort_order: number }>>`
          select allergens.sort_order
          from allergens
          inner join allergen_translations
            on allergen_translations.allergen_id = allergens.id
          where allergen_translations.name = 'Alérgeno E2E actualizado'
        `;
      });
      return Number(order?.sort_order);
    })
    .toBe(1);

  await page.getByRole("button", { name: "Eliminar Leche" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(
    page.getByText(/No se puede eliminar: está asociado a \d+ productos/),
  ).toBeVisible();
  await allergenRow
    .getByRole("button", { name: "Eliminar Alérgeno E2E actualizado" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(allergenRow).toHaveCount(0);
});

test("administrator manages dietary tags and protects associations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await cleanupE2ETaxonomies();
  await loginAsAdmin(page);
  await page.goto("/admin/tags");

  await page.getByRole("button", { name: "Nueva etiqueta" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Etiqueta E2E");
  await page.getByLabel("Color", { exact: true }).fill("purple");
  await page.getByRole("button", { name: "Crear etiqueta" }).click();
  await page.getByRole("button", { name: "Editar Etiqueta E2E" }).click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Etiqueta E2E actualizada");
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  const tagRow = page
    .getByTestId(/^tag-row-/)
    .filter({ hasText: "Etiqueta E2E actualizada" });
  await tagRow
    .getByRole("button", { name: "Desactivar Etiqueta E2E actualizada" })
    .click();
  await expect(tagRow).toContainText("Inactivo");
  await tagRow
    .getByRole("button", { name: "Activar Etiqueta E2E actualizada" })
    .click();

  const sourceHandle = tagRow.getByRole("button", {
    name: "Reordenar Etiqueta E2E actualizada",
  });
  const targetHandle = page.getByRole("button", {
    name: "Reordenar Vegetariano",
  });
  await expect(sourceHandle).toBeEnabled();
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("No se pudo arrastrar la etiqueta.");
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + 4,
    { steps: 20 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => {
      const [order] = await withDatabase(async (sql) => {
        return sql<Array<{ sort_order: number }>>`
          select tags.sort_order
          from tags
          inner join tag_translations
            on tag_translations.tag_id = tags.id
          where tag_translations.name = 'Etiqueta E2E actualizada'
        `;
      });
      return Number(order?.sort_order);
    })
    .toBe(1);

  await page.getByRole("button", { name: "Eliminar Vegetariano" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(
    page.getByText(/No se puede eliminar: está asociado a \d+ productos/),
  ).toBeVisible();
  await tagRow
    .getByRole("button", { name: "Eliminar Etiqueta E2E actualizada" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(tagRow).toHaveCount(0);
});

test("administrator manages products with existing schema fields", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 1000 });
  await cleanupE2EProducts();
  await loginAsAdmin(page);
  await page.goto("/admin/products");

  await expect(
    page.getByRole("heading", { name: "Productos", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Burrata de muestra", level: 3 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await page.getByLabel("Nombre").fill(" Producto E2E");
  await page
    .getByLabel("Descripción")
    .fill("Producto creado mediante la prueba E2E.");
  await page.getByLabel("Precio completo").fill("12.34");
  const imageInput = page.getByLabel("Seleccionar archivo de imagen");
  await imageInput.setInputFiles({
    name: "archivo-invalido.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("no es una imagen"),
  });
  await expect(
    page.getByRole("alert").filter({
      hasText: "Formato no permitido.",
    }),
  ).toBeVisible();

  await imageInput.setInputFiles({
    name: "imagen-demasiado-grande.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByRole("alert").filter({
      hasText: "La imagen supera el tamaño máximo de 10 MB.",
    }),
  ).toBeVisible();

  const initialImage = await sharp({
    create: {
      width: 1_200,
      height: 800,
      channels: 3,
      background: { r: 184, g: 62, b: 48 },
    },
  })
    .png()
    .toBuffer();
  let releaseCancelledUpload: (() => void) | undefined;
  await page.route("**/api/admin/images", async (route) => {
    await new Promise<void>((resolve) => {
      releaseCancelledUpload = resolve;
    });
    await route.abort();
  });
  await imageInput.setInputFiles({
    name: "producto-e2e-cancelado.png",
    mimeType: "image/png",
    buffer: initialImage,
  });
  await page
    .getByRole("button", { name: "Cancelar subida" })
    .click();
  releaseCancelledUpload?.();
  await expect(
    page.getByRole("alert").filter({ hasText: "Subida cancelada." }),
  ).toBeVisible();
  await page.unroute("**/api/admin/images");

  await imageInput.setInputFiles({
    name: "producto-e2e.png",
    mimeType: "image/png",
    buffer: initialImage,
  });
  await expect(
    page.getByRole("status").filter({
      hasText: "Imagen optimizada.",
    }),
  ).toBeVisible();
  await page.getByLabel("Vegetariano").check();
  await page.getByLabel("Leche").check();
  const selectionPreview = page.getByLabel(
    "Vista previa de etiquetas y alérgenos",
  );
  await expect(selectionPreview).toContainText("Vegetariano");
  await expect(selectionPreview).toContainText("Leche");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "El nombre no puede empezar ni terminar con espacios.",
    }),
  ).toHaveText("El nombre no puede empezar ni terminar con espacios.");

  await page.getByLabel("Nombre").fill("Producto E2E");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(
    page.getByRole("heading", { name: "Producto E2E", level: 3 }),
  ).toBeVisible();

  const [createdImage] = await withDatabase(async (sql) => {
    return sql<Array<{ image_url: string }>>`
      select products.image_url
      from products
      inner join product_translations
        on product_translations.product_id = products.id
      where product_translations.name = 'Producto E2E'
    `;
  });
  expect(createdImage?.image_url).toMatch(
    /^\/uploads\/products\/.+\.desktop\.webp$/,
  );
  const createdDesktopResponse = await page.request.get(
    createdImage?.image_url ?? "",
  );
  const createdMobileResponse = await page.request.get(
    createdImage?.image_url.replace(/\.desktop\.webp$/, ".mobile.webp") ?? "",
  );
  expect(createdDesktopResponse.ok()).toBe(true);
  expect(createdMobileResponse.ok()).toBe(true);
  expect(createdDesktopResponse.headers()["content-type"]).toBe("image/webp");

  await withDatabase(async (sql) => {
    await sql`
      update tags
      set is_active = false
      where id in (
        select tag_id from tag_translations where name = 'Vegetariano'
      )
    `;
    await sql`
      update allergens
      set is_active = false
      where id in (
        select allergen_id from allergen_translations where name = 'Leche'
      )
    `;
  });
  await page.reload();
  await page.getByRole("button", { name: "Editar Producto E2E" }).click();
  await expect(page.getByLabel("Vegetariano · inactiva")).toBeChecked();
  await expect(page.getByLabel("Leche · inactivo")).toBeChecked();
  await withDatabase(async (sql) => {
    await sql`
      update tags
      set is_active = true
      where id in (
        select tag_id from tag_translations where name = 'Vegetariano'
      )
    `;
    await sql`
      update allergens
      set is_active = true
      where id in (
        select allergen_id from allergen_translations where name = 'Leche'
      )
    `;
  });
  const replacementImage = await sharp({
    create: {
      width: 900,
      height: 900,
      channels: 3,
      background: { r: 36, g: 88, b: 73 },
    },
  })
    .webp()
    .toBuffer();
  await page.getByLabel("Seleccionar archivo de imagen").setInputFiles({
    name: "producto-e2e-reemplazo.webp",
    mimeType: "image/webp",
    buffer: replacementImage,
  });
  await expect(
    page.getByRole("status").filter({
      hasText: "Imagen optimizada.",
    }),
  ).toBeVisible();
  await page.getByLabel("Nombre").fill("Producto E2E actualizado");
  await page
    .getByLabel("Descripción")
    .fill("Descripción actualizada desde PostgreSQL.");
  await page.getByLabel("Precio completo").fill("13.45");
  await page.getByLabel("Media ración").fill("7.00");
  await page.getByLabel("Visible").uncheck();
  await page.getByLabel("Agotado").check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  const testProductRow = page
    .getByTestId(/^product-row-/)
    .filter({ hasText: "Producto E2E actualizado" });
  await expect(testProductRow).toContainText("13,45");
  await expect(testProductRow).toContainText("No visible");
  await expect(testProductRow).toContainText("Agotado");

  const [replacementStoredImage] = await withDatabase(async (sql) => {
    return sql<Array<{ image_url: string }>>`
      select products.image_url
      from products
      inner join product_translations
        on product_translations.product_id = products.id
      where product_translations.name = 'Producto E2E actualizado'
    `;
  });
  expect(replacementStoredImage?.image_url).toMatch(
    /^\/uploads\/products\/.+\.desktop\.webp$/,
  );
  expect(replacementStoredImage?.image_url).not.toBe(createdImage?.image_url);
  await expect
    .poll(async () =>
      createdImage?.image_url
        ? (await page.request.get(createdImage.image_url)).status()
        : 404,
    )
    .toBe(404);

  await testProductRow
    .getByRole("button", { name: "Editar Producto E2E actualizado" })
    .click();
  await page.getByRole("button", { name: "Eliminar imagen" }).click();
  const [imageBeforeSave] = await withDatabase(async (sql) => {
    return sql<Array<{ image_url: string }>>`
      select products.image_url
      from products
      inner join product_translations
        on product_translations.product_id = products.id
      where product_translations.name = 'Producto E2E actualizado'
    `;
  });
  expect(imageBeforeSave?.image_url).toBe(replacementStoredImage?.image_url);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    testProductRow.getByRole("img", {
      name: "Producto E2E actualizado sin imagen",
    }),
  ).toBeVisible();
  const [imageAfterSave] = await withDatabase(async (sql) => {
    return sql<Array<{ image_url: string }>>`
      select products.image_url
      from products
      inner join product_translations
        on product_translations.product_id = products.id
      where product_translations.name = 'Producto E2E actualizado'
    `;
  });
  expect(imageAfterSave?.image_url).toBe("");
  await expect
    .poll(async () =>
      replacementStoredImage?.image_url
        ? (await page.request.get(replacementStoredImage.image_url)).status()
        : 404,
    )
    .toBe(404);

  await testProductRow
    .getByRole("button", { name: "Mostrar Producto E2E actualizado" })
    .click();
  await expect(
    testProductRow.getByRole("button", {
      name: "Ocultar Producto E2E actualizado",
    }),
  ).toBeVisible();

  await page.goto("/es");
  const publicTestProduct = page
    .getByTestId("product-card")
    .filter({ hasText: "Producto E2E actualizado" });
  await expect(publicTestProduct).toContainText("Sin imagen");
  await expect(publicTestProduct).toContainText("Vegetariano");
  await publicTestProduct.getByLabel("Mostrar alérgeno Leche").click();
  await expect(
    publicTestProduct.getByRole("tooltip", { name: "Leche" }),
  ).toBeVisible();
  await page.goto("/admin/products");

  const targetProductRow = page
    .getByTestId(/^product-row-/)
    .filter({ hasText: "Burrata de muestra" });
  const sourceHandle = testProductRow.getByRole("button", {
    name: "Reordenar Producto E2E actualizado",
  });
  const targetHandle = targetProductRow.getByRole("button", {
    name: "Reordenar Burrata de muestra",
  });
  await expect(sourceHandle).toBeEnabled();
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error(
      "No se pudieron calcular las posiciones del producto arrastrable.",
    );
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + 4,
    { steps: 20 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => {
      const [productOrder] = await withDatabase(async (sql) => {
        return sql<Array<{ sort_order: number }>>`
          select products.sort_order
          from products
          inner join product_translations
            on product_translations.product_id = products.id
          where product_translations.name = 'Producto E2E actualizado'
        `;
      });
      return Number(productOrder?.sort_order);
    })
    .toBe(1);

  await testProductRow
    .getByRole("button", { name: "Eliminar Producto E2E actualizado" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Producto E2E actualizado",
      level: 3,
    }),
  ).toHaveCount(0);

  await page.goto("/es");
  await expect(
    page.getByRole("heading", { name: "Burrata de muestra", level: 3 }),
  ).toBeVisible();
  await expect(page.getByText("Producto E2E actualizado")).toHaveCount(0);
});

test("administrator edits branding with live preview and persistence", async ({
  page,
}) => {
  const backup = await captureBrandingBackup();
  await loginAsAdmin(page);
  await page.goto("/admin/branding");

  await expect(
    page.getByRole("heading", { name: "Branding", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre del restaurante")).toHaveValue(
    backup.name,
  );

  await page
    .getByLabel("Nombre del restaurante")
    .fill("Piccolo La Ràpita E2E");
  await page.getByLabel("Eslogan").fill("Eslogan temporal E2E");
  await page.getByLabel("Teléfono").fill("+34 900 000 001");
  await page.getByLabel("Martes apertura 1").fill("13:05");
  await expect(
    page
      .locator("aside")
      .getByRole("heading", { name: "Piccolo La Ràpita E2E", level: 2 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Branding guardado correctamente.",
  );

  await page.reload();
  await expect(page.getByLabel("Nombre del restaurante")).toHaveValue(
    "Piccolo La Ràpita E2E",
  );
  await expect(page.getByLabel("Eslogan")).toHaveValue("Eslogan temporal E2E");
  await expect(page.getByLabel("Teléfono")).toHaveValue("+34 900 000 001");
  await expect(page.getByLabel("Martes apertura 1")).toHaveValue("13:05");

  await page.getByLabel("Nombre del restaurante").fill(backup.name);
  await page.getByLabel("Eslogan").fill(backup.slogan);
  await page.getByLabel("Teléfono").fill(backup.phone);
  await page
    .getByLabel("Martes apertura 1")
    .fill(backup.tuesdayFirstOpensAt);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Branding guardado correctamente.",
  );

  await page.goto("/es");
  await expect(
    page.getByRole("heading", { name: backup.name, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(backup.slogan)).toBeVisible();
});

test("menu settings normalize defaults and control the public menu", async ({
  page,
}) => {
  await captureMenuSettingsBackup();
  await withDatabase(async (sql) => {
    await sql`
      update restaurant_settings
      set menu_display_settings = null, updated_at = now()
    `;
  });
  await loginAsAdmin(page);
  await page.goto("/admin/menu-settings");

  const booleanLabels = [
    "Mostrar imágenes",
    "Mostrar descripciones",
    "Mostrar precios",
    "Mostrar etiquetas",
    "Mostrar alérgenos",
    "Mostrar media ración",
  ];

  for (const label of booleanLabels) {
    await expect(page.getByLabel(label)).toBeChecked();
  }
  await expect(page.getByLabel("Tarjetas")).toBeChecked();

  for (const label of booleanLabels) {
    await page.getByLabel(label).uncheck();
  }
  await page.getByText("Lista", { exact: true }).click();
  const previewCard = page.locator("aside").getByTestId("product-card").first();
  await expect(previewCard).toHaveAttribute("data-layout", "list");
  await expect(previewCard.locator("img")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Guardar configuración" })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Configuración de la carta guardada.",
  );
  await page.reload();

  for (const label of booleanLabels) {
    await expect(page.getByLabel(label)).not.toBeChecked();
  }
  await expect(page.getByLabel("Lista")).toBeChecked();

  await page.goto("/es");
  const publicPizza = page
    .getByTestId("product-card")
    .filter({ hasText: "Pizza de muestra" });
  await expect(publicPizza).toHaveAttribute("data-layout", "list");
  await expect(publicPizza.locator("img")).toHaveCount(0);
  await expect(
    publicPizza.getByText(
      "Tomate, mozzarella y albahaca usados solo para representar el diseño.",
    ),
  ).toHaveCount(0);
  await expect(publicPizza.getByText("11,80 €")).toHaveCount(0);
  await expect(publicPizza.getByText("Vegetariano")).toHaveCount(0);
  await expect(publicPizza.getByText("Alérgenos:")).toHaveCount(0);
  await expect(publicPizza.getByText(/Media ración/)).toHaveCount(0);

  await withDatabase(async (sql) => {
    await sql`
      update restaurant_settings
      set
        menu_display_settings = ${sql.json({
          showImages: false,
          layout: "list",
          futureSetting: "ignored",
        })},
        updated_at = now()
    `;
  });
  await page.goto("/admin/menu-settings");
  await expect(page.getByLabel("Mostrar imágenes")).not.toBeChecked();
  for (const label of booleanLabels.slice(1)) {
    await expect(page.getByLabel(label)).toBeChecked();
  }
  await expect(page.getByLabel("Lista")).toBeChecked();

  await page.goto("/es");
  const normalizedPizza = page
    .getByTestId("product-card")
    .filter({ hasText: "Pizza de muestra" });
  await expect(normalizedPizza.locator("img")).toHaveCount(0);
  await expect(normalizedPizza).toContainText(
    "Tomate, mozzarella y albahaca usados solo para representar el diseño.",
  );
  await expect(normalizedPizza).toContainText("11,80 €");
  await expect(normalizedPizza).toContainText("Vegetariano");
  await expect(normalizedPizza).toContainText("Alérgenos:");
  await expect(normalizedPizza).toContainText("Media ración");

  await restoreMenuSettingsBackup();
  await page.goto("/es");
  await expect(
    page.getByRole("heading", { name: "Piccolo La Ràpita", level: 1 }),
  ).toBeVisible();
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

test.afterAll(async () => {
  await restoreMenuSettingsBackup();
  await restoreBrandingBackup();
  await cleanupE2EProducts();
  await cleanupE2ETaxonomies();
  await cleanupE2ECategories();
});
