import { expect, test, type Page } from "@playwright/test";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import sharp from "sharp";

import {
  getLocaleConfig,
  SUPPORTED_LOCALE_CODES,
  SUPPORTED_LOCALES,
} from "@/config/locales";
import {
  buildPublicMenuUrl,
  getQrDownloadFilename,
} from "@/features/admin/qr/qr-url";

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
            row_number() over (
              partition by parent_category_id
              order by sort_order, id
            )::integer as next_order
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

async function cleanupE2ELanguages() {
  await withDatabase(async (sql) => {
    await sql.begin(async (transaction) => {
      await transaction`
        update restaurant_settings
        set default_locale = 'es', updated_at = now()
      `;
      await transaction`delete from product_translations where locale = 'ca'`;
      await transaction`delete from category_translations where locale = 'ca'`;
      await transaction`delete from tag_translations where locale = 'ca'`;
      await transaction`delete from allergen_translations where locale = 'ca'`;
      await transaction`delete from restaurant_translations where locale = 'ca'`;
      await transaction`delete from restaurant_locales where locale = 'ca'`;
    });
  });
}

async function cleanupE2ESpecialHours() {
  await withDatabase(async (sql) => {
    await sql`
      delete from special_opening_hours
      where reason like '%E2E%'
    `;
  });
}

type ReservationSettingsBackup = {
  restaurant_id: string;
  is_enabled: boolean;
  duration_minutes: number;
  slot_interval_minutes: number;
  minimum_advance_minutes: number;
  maximum_advance_days: number;
  maximum_party_size: number;
  slot_capacity: number;
  large_group_phone: string | null;
  customer_message: string;
  policy_text: string;
  initial_status: string;
};
let reservationSettingsBackup: ReservationSettingsBackup | null = null;
let reservationSettingsCaptured = false;

async function captureReservationSettingsBackup() {
  const [row] = await withDatabase((sql) =>
    sql<Array<ReservationSettingsBackup>>`
      select * from reservation_settings limit 1
    `,
  );
  reservationSettingsBackup = row ?? null;
  reservationSettingsCaptured = true;
}

async function cleanupE2EReservations() {
  await withDatabase((sql) => sql`
    delete from reservations where guest_name like '%E2E%'
  `);
}

async function restoreReservationSettingsBackup() {
  if (!reservationSettingsCaptured) return;
  await withDatabase(async (sql) => {
    if (!reservationSettingsBackup) {
      await sql`delete from reservation_settings`;
      return;
    }
    const value = reservationSettingsBackup;
    await sql`
      insert into reservation_settings (
        restaurant_id, is_enabled, duration_minutes, slot_interval_minutes,
        minimum_advance_minutes, maximum_advance_days, maximum_party_size,
        slot_capacity, large_group_phone, customer_message, policy_text,
        initial_status
      ) values (
        ${value.restaurant_id}, ${value.is_enabled}, ${value.duration_minutes},
        ${value.slot_interval_minutes}, ${value.minimum_advance_minutes},
        ${value.maximum_advance_days}, ${value.maximum_party_size},
        ${value.slot_capacity}, ${value.large_group_phone},
        ${value.customer_message}, ${value.policy_text}, ${value.initial_status}
      )
      on conflict (restaurant_id) do update set
        is_enabled = excluded.is_enabled,
        duration_minutes = excluded.duration_minutes,
        slot_interval_minutes = excluded.slot_interval_minutes,
        minimum_advance_minutes = excluded.minimum_advance_minutes,
        maximum_advance_days = excluded.maximum_advance_days,
        maximum_party_size = excluded.maximum_party_size,
        slot_capacity = excluded.slot_capacity,
        large_group_phone = excluded.large_group_phone,
        customer_message = excluded.customer_message,
        policy_text = excluded.policy_text,
        initial_status = excluded.initial_status,
        updated_at = now()
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
  await expect(
    page.getByText(/^(Abierto ahora|Cerrado|Cerrado hoy|Abre próximamente|Cierra próximamente)$/),
  ).toBeVisible();

  const callButton = page.getByRole("link", {
    name: /^Llamar:/,
  }).last();
  await expect(callButton).toBeVisible();
  await expect(callButton).toHaveAttribute("href", "tel:+34900000000");

  const directions = page.getByRole("link", { name: /Cómo llegar/ });
  await expect(directions).toHaveAttribute("target", "_blank");
  await expect(directions).toHaveAttribute("rel", "noopener noreferrer");
  await expect(directions).toHaveAttribute(
    "href",
    /google\.com\/maps\/search\/\?api=1&query=/,
  );

  await page.getByRole("button", { name: "Horario" }).click();
  const hoursDialog = page.getByRole("dialog", { name: "Horario" });
  await expect(hoursDialog).toBeVisible();
  await expect(hoursDialog.locator('[aria-current="date"]')).toContainText(
    "Hoy",
  );
  await expect(hoursDialog).toContainText("Primer turno: 13:00–16:00");
  await expect(hoursDialog).toContainText("Segundo turno: 19:30–23:00");
  await expect(hoursDialog).toContainText("Cerrado");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Horario" }),
  ).toHaveCount(0);

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
  const pizzaCardBeforeSearch = page
    .getByTestId("product-card")
    .filter({ hasText: "Pizza de muestra" });
  await expect(
    pizzaCardBeforeSearch.getByLabel("Ver producto: Pizza de muestra"),
  ).toBeVisible();
  await expect(
    pizzaCardBeforeSearch.getByRole("link", {
      name: "Ver producto",
      exact: true,
    }),
  ).toBeVisible();
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

test("public contact actions disappear when data is absent", async ({ page }) => {
  const [contact] = await withDatabase(async (sql) => {
    return sql<Array<{ id: string; phone: string; address: string }>>`
      select id, phone, address from restaurant_settings limit 1
    `;
  });
  if (!contact) throw new Error("No se pudo respaldar el contacto.");

  try {
    await withDatabase(async (sql) => {
      await sql`
        update restaurant_settings
        set phone = '', address = '', updated_at = now()
        where id = ${contact.id}
      `;
    });
    await page.goto("/es");
    await expect(page.getByRole("link", { name: /^Llamar:/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Cómo llegar/ })).toHaveCount(0);
  } finally {
    await withDatabase(async (sql) => {
      await sql`
        update restaurant_settings
        set phone = ${contact.phone}, address = ${contact.address}, updated_at = now()
        where id = ${contact.id}
      `;
    });
  }
});

test("product detail opens from menu and returns to saved position", async ({
  page,
}) => {
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
  await page.goto("/es");
  await page.getByRole("button", { name: "Pizze · 2" }).click();
  await page.waitForTimeout(600);
  const previousScrollY = await page.evaluate(() => window.scrollY);
  await page
    .getByRole("link", { name: "Pizza de muestra", exact: true })
    .click();

  await expect(page).toHaveURL(/\/es\/producto\/[0-9a-f-]{36}-pizza-de-muestra$/);
  const detail = page.getByTestId("product-detail");
  await expect(
    detail.getByRole("heading", { name: "Pizza de muestra", level: 1 }),
  ).toBeVisible();
  await expect(detail).toContainText("Pizze");
  await expect(detail).toContainText("11,80 €");
  await expect(detail).toContainText("7,20 €");
  await expect(detail).toContainText("Vegetariano");
  await expect(detail).toContainText("Gluten");
  await expect(detail).toContainText("Leche");

  await page.getByRole("button", { name: "Ampliar imagen" }).click();
  await expect(
    page.getByRole("dialog", { name: "Ampliar imagen" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");
  await page.getByRole("button", { name: "Cerrar imagen" }).click();
  await expect(
    page.getByRole("dialog", { name: "Ampliar imagen" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Ampliar imagen" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Ampliar imagen" }),
  ).toHaveCount(0);

  const related = page.getByTestId("related-products");
  await expect(
    related.getByRole("heading", {
      name: "Productos relacionados",
      level: 2,
    }),
  ).toBeVisible();
  await expect(related).toContainText("Pizza piccante de muestra");
  await expect(
    related.getByRole("heading", { name: "Pizza de muestra", level: 3 }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Volver a la carta" }).click();
  await expect(page).toHaveURL(/\/es$/);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThanOrEqual(Math.max(0, previousScrollY - 120));
  expect(hydrationErrors).toEqual([]);
});

test("product detail exposes share, SEO, JSON-LD and stable identifiers", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          sessionStorage.setItem("shared-product-url", value);
        },
      },
    });
  });
  await page.goto("/es");
  const productHref = await page
    .getByRole("link", { name: "Pizza de muestra", exact: true })
    .getAttribute("href");

  if (!productHref) {
    throw new Error("La tarjeta no contiene una URL de producto.");
  }

  await page.goto(productHref);
  await expect(page).toHaveTitle(
    "Pizza de muestra | Piccolo La Ràpita",
  );
  const canonicalHref = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href");
  const canonicalOrigin = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ).origin;
  expect(canonicalHref).toMatch(
    new RegExp(`^${canonicalOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/es/producto/`),
  );
  await expect(page.locator('link[hreflang="ca"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Pizza de muestra | Piccolo La Ràpita",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );

  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  const jsonLd = JSON.parse(structuredData ?? "{}") as {
    "@type"?: string;
    name?: string;
    offers?: { price?: string; priceCurrency?: string };
  };
  expect(jsonLd["@type"]).toBe("MenuItem");
  expect(jsonLd.name).toBe("Pizza de muestra");
  expect(jsonLd.offers?.price).toBe("11.80");
  expect(jsonLd.offers?.priceCurrency).toBe("EUR");

  await page.getByRole("button", { name: "Compartir" }).click();
  await expect(page.getByRole("status")).toHaveText("Enlace copiado");
  await expect
    .poll(() =>
      page.evaluate(() => sessionStorage.getItem("shared-product-url")),
    )
    .toBe(page.url());

  const segment = productHref.split("/").at(-1) ?? "";
  const productId = segment.slice(0, 36);
  await page.goto(`/es/producto/${productId}-texto-antiguo`);
  await expect(
    page.getByRole("heading", { name: "Pizza de muestra", level: 1 }),
  ).toBeVisible();

  await page.goto("/es");
  await page
    .getByRole("link", { name: "Focaccia de muestra", exact: true })
    .click();
  await expect(page.getByText("Producto agotado")).toBeVisible();
});

test("hidden products, hidden categories and invalid locales return 404", async ({
  page,
}) => {
  const [record] = await withDatabase(async (sql) => {
    return sql<Array<{ product_id: string; category_id: string }>>`
      select products.id as product_id, products.category_id
      from products
      inner join product_translations
        on product_translations.product_id = products.id
      where product_translations.locale = 'es'
        and product_translations.name = 'Pizza de muestra'
      limit 1
    `;
  });

  if (!record) {
    throw new Error("No se encontró el producto para validar el 404.");
  }

  const productPath = `/es/producto/${record.product_id}-pizza-de-muestra`;

  try {
    await withDatabase(async (sql) => {
      await sql`
        update products
        set is_active = false, updated_at = now()
        where id = ${record.product_id}
      `;
    });
    await page.goto(productPath);
    await expect(page.getByText("404", { exact: true })).toBeVisible();
    await expect(page.getByText("Pizza de muestra")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );

    await withDatabase(async (sql) => {
      await sql`
        update products
        set is_active = true, updated_at = now()
        where id = ${record.product_id}
      `;
      await sql`
        update categories
        set is_active = false, updated_at = now()
        where id = ${record.category_id}
      `;
    });
    await page.goto(productPath);
    await expect(page.getByText("404", { exact: true })).toBeVisible();

    await page.goto(
      `/ca/producto/${record.product_id}-pizza-de-muestra`,
    );
    await expect(page.getByText("404", { exact: true })).toBeVisible();
    await page.goto("/es/producto/identificador-invalido");
    await expect(page.getByText("404", { exact: true })).toBeVisible();
  } finally {
    await withDatabase(async (sql) => {
      await sql`
        update products
        set is_active = true, updated_at = now()
        where id = ${record.product_id}
      `;
      await sql`
        update categories
        set is_active = true, updated_at = now()
        where id = ${record.category_id}
      `;
    });
  }
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

    const productHref = await page
      .getByRole("link", { name: "Burrata de muestra", exact: true })
      .getAttribute("href");

    if (!productHref) {
      throw new Error("No se encontró la ficha responsive del producto.");
    }

    await page.goto(productHref);
    await expect(
      page.getByRole("heading", { name: "Burrata de muestra", level: 1 }),
    ).toBeVisible();
    const detailDimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(detailDimensions.documentWidth).toBeLessThanOrEqual(
      detailDimensions.viewportWidth,
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
  await expect(page.getByTestId("admin-metric-subcategories")).toContainText(
    "0",
  );
  await expect(page.getByTestId("admin-metric-products")).toContainText("6");
  await expect(page.getByTestId("admin-metric-languages")).toContainText("1");
  await expect(page.getByTestId("admin-metric-allergens")).toContainText("3");
  await expect(page.getByTestId("admin-metric-tags")).toContainText("5");
  await expect(page.getByTestId("admin-metric-today-reservations")).toContainText("0");
  await expect(page.getByTestId("admin-metric-today-guests")).toContainText("0");
  await expect(page.getByTestId("admin-metric-today-pending")).toContainText("0");
  await expect(page.getByText("Sin actividad reciente")).toBeVisible();

  await page
    .getByRole("button", { name: "Abrir menú de administración" })
    .click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByText("Disponible próximamente")).toHaveCount(0);

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

test("QR URL builder normalizes base paths and locales", () => {
  const supportedLocales = ["es", "ca", "en"];

  expect(
    buildPublicMenuUrl(
      "https://dominio.example/base/es/",
      "ca",
      supportedLocales,
    ),
  ).toBe("https://dominio.example/base/ca");
  expect(
    buildPublicMenuUrl(
      "https://dominio.example//base///",
      "en",
      supportedLocales,
    ),
  ).toBe("https://dominio.example/base/en");
  expect(getQrDownloadFilename("es", "png")).toBe(
    "piccolo-carta-qr-es.png",
  );
  expect(getQrDownloadFilename("ca", "svg")).toBe(
    "piccolo-carta-qr-ca.svg",
  );
  expect(() =>
    buildPublicMenuUrl(
      "https://dominio.example/es",
      "ro",
      supportedLocales,
    ),
  ).toThrow("El locale seleccionado no está disponible.");
});

test("legacy QR route redirects safely and preserves valid options", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto(
    "/admin/qr?locale=es&size=2048&margin=6&correction=Q&evil=ignored",
  );
  await expect(page).toHaveURL(
    /\/admin\/qr-code\?locale=es&size=2048&margin=6&correction=Q$/,
  );
  await expect(page.getByLabel("2048 px")).toBeChecked();
  await expect(page.getByLabel("Margen exterior")).toHaveValue("6");
  await expect(page.getByLabel("Nivel de corrección")).toHaveValue("Q");
});

test("administrator generates downloads and print-ready QR", async ({
  page,
}) => {
  const [settingsBefore] = await withDatabase(async (sql) => {
    return sql<Array<{ fingerprint: string }>>`
      select md5(
        coalesce(menu_display_settings::text, 'null') || updated_at::text
      ) as fingerprint
      from restaurant_settings
      limit 1
    `;
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          sessionStorage.setItem("copied-qr-url", value);
        },
      },
    });
  });
  const clientErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      clientErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => clientErrors.push(error.message));
  await loginAsAdmin(page);
  await page.goto("/admin/qr-code");

  await expect(
    page.getByRole("heading", { name: "Código QR", level: 1 }),
  ).toBeVisible();
  const destination = page.locator("[data-qr-destination]");
  await expect(destination).toHaveText(
    "https://menu.piccolo.test/base/es",
  );
  await expect(destination).not.toContainText("//base");
  await expect(page.getByLabel("Idioma", { exact: true })).toHaveValue("es");
  await expect(
    page.getByLabel("Idioma", { exact: true }).locator("option"),
  ).toHaveCount(1);
  await expect(page.getByTestId("qr-preview-card")).toContainText(
    "Piccolo La Ràpita",
  );
  await expect(page.getByTestId("qr-preview-card")).toContainText(
    "Cocina con sabor italiano",
  );
  const previewImage = page.getByTestId("qr-preview-image");
  await expect(previewImage).toHaveAttribute(
    "alt",
    "Código QR para https://menu.piccolo.test/base/es",
  );
  const initialQrSource = await previewImage.getAttribute("src");
  expect(initialQrSource).toMatch(/^data:image\/png;base64,/);

  await page.getByRole("button", { name: "Copiar enlace" }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("copied-qr-url")))
    .toBe("https://menu.piccolo.test/base/es");
  await expect(page.getByText("Enlace copiado")).toBeVisible();

  await page.getByLabel("2048 px").check({ force: true });
  await expect(page.getByLabel("2048 px")).toBeChecked();
  await page.getByLabel("512 px").check({ force: true });
  await page.getByLabel("Margen exterior").fill("6");
  await page.getByLabel("Nivel de corrección").selectOption("Q");
  await expect
    .poll(() => previewImage.getAttribute("src"))
    .not.toBe(initialQrSource);
  await page.getByLabel("Color del código").fill("#002b22");
  await page.getByLabel("Color de fondo").fill("#ffffff");
  const restaurantNameToggle = page.getByLabel(
    "Mostrar nombre del restaurante",
  );
  const sloganToggle = page.getByLabel("Mostrar eslogan");
  await restaurantNameToggle.focus();
  await page.keyboard.press("Space");
  await expect(restaurantNameToggle).not.toBeChecked();
  await page.getByLabel("Mostrar texto de llamada").uncheck();
  await sloganToggle.uncheck();
  const previewCard = page.getByTestId("qr-preview-card");
  await expect(previewCard.getByText("Piccolo La Ràpita")).toHaveCount(0);
  await expect(
    previewCard.getByText("Escanea para ver nuestra carta"),
  ).toHaveCount(0);
  await expect(
    previewCard.getByText("Cocina con sabor italiano"),
  ).toHaveCount(0);
  await restaurantNameToggle.check();
  await sloganToggle.check();
  await page.getByLabel("Mostrar texto de llamada").check();
  await page.getByText("Cuadrado", { exact: true }).click();
  await expect(restaurantNameToggle).toBeDisabled();
  await expect(previewCard.getByText("Piccolo La Ràpita")).toHaveCount(0);
  await page.getByText("Vertical", { exact: true }).click();
  await page.getByLabel("Fondo transparente").check();

  const pngDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PNG" }).click();
  const pngDownload = await pngDownloadPromise;
  expect(pngDownload.suggestedFilename()).toBe("piccolo-carta-qr-es.png");
  const pngPath = await pngDownload.path();

  if (!pngPath) {
    throw new Error("La descarga PNG no generó un archivo.");
  }

  const png = await readFile(pngPath);
  expect([...png.subarray(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  const svgDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar SVG" }).click();
  const svgDownload = await svgDownloadPromise;
  expect(svgDownload.suggestedFilename()).toBe("piccolo-carta-qr-es.svg");
  const svgPath = await svgDownload.path();

  if (!svgPath) {
    throw new Error("La descarga SVG no generó un archivo.");
  }

  const svg = await readFile(svgPath, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("Código QR para https://menu.piccolo.test/base/es");
  expect(svg).toContain("Piccolo La Ràpita");
  expect(svg).toContain("Cocina con sabor italiano");
  expect(svg).not.toContain('<rect width="100%" height="100%"');

  await page.evaluate(() => {
    window.print = () => sessionStorage.setItem("print-called", "true");
  });
  await page.getByRole("button", { name: "Imprimir cartel QR" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => sessionStorage.getItem("print-called")),
    )
    .toBe("true");

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-qr-print-poster]")).toHaveCSS(
    "display",
    "flex",
  );
  await expect(page.locator("#admin-sidebar")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await page.emulateMedia({ media: "screen" });

  await expect(
    page.getByRole("status").filter({
      hasText: "Código QR descargado",
    }),
  ).toHaveText("Código QR descargado");
  const [settingsAfter] = await withDatabase(async (sql) => {
    return sql<Array<{ fingerprint: string }>>`
      select md5(
        coalesce(menu_display_settings::text, 'null') || updated_at::text
      ) as fingerprint
      from restaurant_settings
      limit 1
    `;
  });
  expect(settingsAfter?.fingerprint).toBe(settingsBefore?.fingerprint);
  expect(clientErrors).toEqual([]);
});

test("QR administration is responsive across supported viewports", async ({
  page,
}) => {
  await loginAsAdmin(page);

  for (const viewport of [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1_024 },
    { width: 1_280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/qr-code");
    await expect(page.getByTestId("qr-preview-card")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(
      dimensions.viewportWidth,
    );
  }
});

test("central locale configuration exposes the nine supported languages", () => {
  expect(SUPPORTED_LOCALE_CODES).toEqual([
    "es",
    "ca",
    "en",
    "ro",
    "fr",
    "de",
    "nl",
    "eu",
    "it",
  ]);
  expect(getLocaleConfig("nl")?.nativeName).toBe("Nederlands");
  expect(getLocaleConfig("eu")?.nativeName).toBe("Euskara");
  expect(SUPPORTED_LOCALES.every((locale) => locale.direction === "ltr")).toBe(
    true,
  );
});

test("administrator activates translates and publishes Catalan", async ({
  page,
}) => {
  await cleanupE2ELanguages();
  await loginAsAdmin(page);
  await page.goto("/admin/languages");

  for (const locale of SUPPORTED_LOCALES) {
    await expect(
      page.getByTestId(`language-${locale.code}`),
    ).toContainText(locale.nativeName);
  }
  const languagePageDimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(languagePageDimensions.documentWidth).toBeLessThanOrEqual(
    languagePageDimensions.viewportWidth,
  );

  const spanishRow = page.getByTestId("language-es");
  await expect(spanishRow).toContainText("Principal: Sí");
  await expect(spanishRow).toContainText("Publicado: Sí");
  await expect(
    spanishRow.getByRole("button", { name: "Desactivar" }),
  ).toBeDisabled();

  const catalanRow = page.getByTestId("language-ca");
  await expect(catalanRow).toContainText("Activado: No");
  await catalanRow.getByRole("button", { name: "Activar" }).click();
  await expect(catalanRow).toContainText("Activado: Sí");
  await expect(
    catalanRow.getByRole("button", { name: "Publicar" }),
  ).toBeDisabled();

  await page.goto("/ca");
  await expect(page.getByText("404", { exact: true })).toBeVisible();

  await page.goto("/admin/languages?edit=ca");
  await page.locator('input[name="restaurant-name"]').fill("Piccolo La Ràpita CA");
  await page.locator('input[name="restaurant-slogan"]').fill("Cuina italiana");
  await page
    .locator('textarea[name="restaurant-description"]')
    .fill("Descripció del restaurant");
  const categoryInputs = page.locator('input[name^="category-"]');
  for (let index = 0; index < (await categoryInputs.count()); index += 1) {
    await categoryInputs.nth(index).fill(`Categoria CA ${index + 1}`);
  }
  const productNameInputs = page.locator('input[name^="product-name-"]');
  for (let index = 0; index < (await productNameInputs.count()); index += 1) {
    await productNameInputs.nth(index).fill(`Producte CA ${index + 1}`);
  }
  const productDescriptionInputs = page.locator(
    'textarea[name^="product-description-"]',
  );
  for (
    let index = 0;
    index < (await productDescriptionInputs.count());
    index += 1
  ) {
    await productDescriptionInputs
      .nth(index)
      .fill(`Descripció CA ${index + 1}`);
  }
  const tagInputs = page.locator('input[name^="tag-"]');
  for (let index = 0; index < (await tagInputs.count()); index += 1) {
    await tagInputs.nth(index).fill(`Etiqueta CA ${index + 1}`);
  }
  const allergenInputs = page.locator('input[name^="allergen-"]');
  for (let index = 0; index < (await allergenInputs.count()); index += 1) {
    await allergenInputs.nth(index).fill(`Al·lergen CA ${index + 1}`);
  }
  await page.getByRole("button", { name: "Guardar traducciones" }).click();
  await expect(page.getByText("Traducciones guardadas correctamente.")).toBeVisible();

  await page.goto("/admin/languages");
  const completedCatalanRow = page.getByTestId("language-ca");
  await expect(completedCatalanRow).toContainText("100 %");
  await completedCatalanRow.getByRole("button", { name: "Publicar" }).click();
  await expect(completedCatalanRow).toContainText("Publicado: Sí");
  page.once("dialog", (dialog) => dialog.accept());
  await completedCatalanRow
    .getByRole("button", { name: "Hacer principal" })
    .click();
  await expect(completedCatalanRow).toContainText("Principal: Sí");
  const updatedSpanishRow = page.getByTestId("language-es");
  page.once("dialog", (dialog) => dialog.accept());
  await updatedSpanishRow
    .getByRole("button", { name: "Hacer principal" })
    .click();
  await expect(updatedSpanishRow).toContainText("Principal: Sí");

  await page.goto("/ca");
  await expect(
    page.getByRole("heading", { name: "Piccolo La Ràpita CA", level: 1 }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ca");
  await expect(page.getByLabel("Idioma")).toHaveValue("ca");
  await expect(page.getByLabel("Idioma").locator("option")).toHaveCount(2);
  await page.getByRole("button", { name: "Horari" }).click();
  await expect(page.getByRole("dialog", { name: "Horari" })).toContainText(
    "Primer torn",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator('link[hreflang="ca"]')).toHaveCount(1);
  await expect(page.locator('link[hreflang="es"]')).toHaveCount(1);
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute(
    "href",
    /\/es$/,
  );

  const productHref = await page
    .getByRole("link", { name: "Producte CA 1", exact: true })
    .getAttribute("href");
  expect(productHref).toMatch(/^\/ca\/producto\/[0-9a-f-]{36}-producte-ca-1$/);
  await page.goto(productHref ?? "/ca");
  const productId = productHref?.split("/").at(-1)?.slice(0, 36);
  await page.getByLabel("Idioma").selectOption("es");
  await expect(page).toHaveURL(
    new RegExp(`/es/producto/${productId}-burrata-de-muestra$`),
  );

  await page.goto("/admin/qr-code");
  const qrLocale = page.getByLabel("Idioma", { exact: true });
  await expect(qrLocale.locator("option")).toHaveCount(2);
  const previousQr = await page.getByTestId("qr-preview-image").getAttribute("src");
  await qrLocale.selectOption("ca");
  await expect(page.locator("[data-qr-destination]")).toContainText("/ca");
  await expect
    .poll(() => page.getByTestId("qr-preview-image").getAttribute("src"))
    .not.toBe(previousQr);
  await expect(page.getByTestId("qr-preview-card")).toContainText(
    "Escaneja per veure la nostra carta",
  );
});

test("administrator previews and prints the real menu without persistence", async ({
  page,
}) => {
  const [before] = await withDatabase(async (sql) => {
    return sql<Array<{ fingerprint: string }>>`
      select md5(coalesce(menu_display_settings::text, 'null') || updated_at::text) as fingerprint
      from restaurant_settings limit 1
    `;
  });
  await loginAsAdmin(page);
  await page.goto("/admin/print-menu");

  await expect(
    page.getByRole("heading", { name: "Carta imprimible", level: 1 }),
  ).toBeVisible();
  const printable = page.locator("[data-print-menu]");
  await expect(printable).toContainText("Piccolo La Ràpita");
  await expect(printable).toContainText("Antipasti");
  await expect(printable).toContainText("Burrata de muestra");
  await expect(printable).toContainText("12,50");

  await page.getByLabel(/Columnas|Columnes/).selectOption("1");
  await expect(printable.locator("[data-print-columns]")).toHaveAttribute(
    "data-print-columns",
    "1",
  );
  await page.getByLabel(/Orientación|Orientació/).selectOption("landscape");
  await expect(printable).toHaveAttribute("data-orientation", "landscape");
  await page.getByLabel("Mostrar descripciones").uncheck();
  await expect(printable).not.toContainText(
    "Composición visual de tomate, burrata y albahaca.",
  );
  await page.getByLabel("Mostrar alérgenos").uncheck();
  await page.getByLabel("Mostrar etiquetas").uncheck();
  await page.getByLabel("Mostrar agotados").uncheck();
  await expect(printable).not.toContainText("Focaccia de muestra");
  await page.getByLabel("Mostrar QR").uncheck();
  await expect(printable.getByRole("img", { name: /QR/ })).toHaveCount(0);

  const [catalan] = await withDatabase(async (sql) => {
    return sql<Array<{ is_published: boolean }>>`
      select is_published from restaurant_locales where locale = 'ca'
    `;
  });
  if (catalan?.is_published) {
    await page.locator("main select").first().selectOption("ca");
    await expect(page).toHaveURL(/\/admin\/print-menu\?locale=ca$/);
    await expect(page.locator("[data-print-menu]")).toContainText(
      "Piccolo La Ràpita CA",
    );
    await expect(page.locator("[data-print-menu]")).toContainText(
      "Producte CA 1",
    );
  }

  await page.evaluate(() => {
    window.print = () => sessionStorage.setItem("print-menu-called", "true");
  });
  await page.getByRole("button", { name: /Imprimir|PDF/ }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("print-menu-called")))
    .toBe("true");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-print-menu]")).toHaveCSS(
    "visibility",
    "visible",
  );
  await expect(page.locator("#admin-sidebar")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await page.emulateMedia({ media: "screen" });

  await page.reload();
  await expect(page.getByLabel(/Columnas|Columnes/)).toHaveValue("2");
  await expect(page.getByLabel(/Orientación|Orientació/)).toHaveValue(
    "portrait",
  );
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

  const [after] = await withDatabase(async (sql) => {
    return sql<Array<{ fingerprint: string }>>`
      select md5(coalesce(menu_display_settings::text, 'null') || updated_at::text) as fingerprint
      from restaurant_settings limit 1
    `;
  });
  expect(after?.fingerprint).toBe(before?.fingerprint);
});

test("administrator manages special hours with public priority", async ({
  page,
}) => {
  await cleanupE2ESpecialHours();
  const [dates] = await withDatabase(async (sql) => {
    return sql<Array<{ today: string; tomorrow: string }>>`
      select
        to_char(current_timestamp at time zone timezone, 'YYYY-MM-DD') as today,
        to_char(
          current_timestamp at time zone timezone + interval '1 day',
          'YYYY-MM-DD'
        ) as tomorrow
      from restaurant_settings
      limit 1
    `;
  });
  if (!dates) throw new Error("No se pudo calcular la fecha local.");

  await loginAsAdmin(page);
  await page.goto("/admin/special-hours");
  await page.getByRole("button", { name: "Mes anterior" }).click();
  await expect(page).toHaveURL(/\/admin\/special-hours\?month=\d{4}-\d{2}/);
  await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/special-hours\\?month=${dates.today.slice(0, 7)}$`),
  );
  await page.getByRole("button", { name: "Nueva excepción" }).click();
  await page.getByLabel("Fecha", { exact: true }).fill(dates.today);
  await page.getByLabel("Tipo").selectOption("closed");
  await page.getByLabel("Motivo opcional").fill("Vacaciones E2E");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(dates.today, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `${dates.today}: closed` }),
  ).toBeVisible();
  await page.getByLabel("Filtrar por fecha").fill(dates.today);
  await expect(page.getByText(dates.today, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtro" }).click();
  await page.getByRole("button", { name: `Duplicar ${dates.today}` }).click();
  await expect(
    page.getByRole("dialog", { name: "Duplicar excepción" }),
  ).toBeVisible();
  await expect(page.getByLabel("Fecha", { exact: true })).toHaveValue(
    dates.tomorrow,
  );
  await page.getByLabel("Motivo opcional").fill("Vacaciones duplicadas E2E");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(dates.tomorrow, { exact: true })).toBeVisible();

  await page.goto("/es");
  await expect(
    page.getByText("Cerrado por Vacaciones E2E").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Horario" }).click();
  await expect(page.getByRole("dialog", { name: "Horario" })).toContainText(
    "Vacaciones E2E",
  );
  await page.keyboard.press("Escape");
  await page.goto("/admin/print-menu");
  await expect(page.locator("[data-print-menu]")).toContainText(
    "Cerrado por Vacaciones E2E",
  );

  const [catalanState] = await withDatabase(async (sql) => {
    return sql<Array<{ is_published: boolean }>>`
      select is_published from restaurant_locales where locale = 'ca'
    `;
  });
  if (catalanState?.is_published) {
    await page.goto("/ca");
    await expect(
      page.getByText("Tancat per Vacaciones E2E").first(),
    ).toBeVisible();
  }

  await page.goto("/admin/special-hours");
  await page.getByRole("button", { name: `Editar ${dates.today}` }).click();
  await page.getByLabel("Tipo").selectOption("special");
  await page.getByLabel("Motivo opcional").fill("Horario especial E2E");
  await page.getByLabel("Apertura 1").fill("00:01");
  await page.getByLabel("Cierre 1").fill("12:00");
  await page.getByLabel("Apertura 2").fill("12:30");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Editar excepción" })
      .getByText("El segundo turno debe estar completo o completamente vacío."),
  ).toBeVisible();
  await page.getByLabel("Cierre 2").fill("23:59");
  await page.getByRole("button", { name: "Guardar" }).click();

  await page.goto("/es");
  await expect(
    page.getByText(/Hoy tenemos horario especial/).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Horario" }).click();
  const specialDialog = page.getByRole("dialog", { name: "Horario" });
  await expect(specialDialog).toContainText("Primer turno: 00:01–12:00");
  await expect(specialDialog).toContainText("Segundo turno: 12:30–23:59");
  await page.keyboard.press("Escape");

  await page.goto("/admin/special-hours");
  await page.getByRole("button", { name: `Eliminar ${dates.tomorrow}` }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await page.getByRole("button", { name: `Eliminar ${dates.today}` }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(page.getByText(dates.today, { exact: true })).toHaveCount(0);
});

test("administrator manages hierarchical categories safely", async ({
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
    .getByRole("button", { name: "Crear subcategoría en Categoría E2E" })
    .click();
  await expect(page.getByLabel("Categoría principal")).toHaveValue(
    /.+/,
  );
  await page.getByLabel("Nombre").fill("Subcategoría E2E");
  await page.getByLabel("Descripción").fill("Segundo nivel E2E.");
  await page.getByRole("button", { name: "Crear categoría" }).click();
  const childCategoryRow = page
    .getByTestId(/^category-row-/)
    .filter({ hasText: "Subcategoría E2E" });
  await expect(childCategoryRow).toBeVisible();
  await expect(
    page
      .getByTestId(/^category-row-/)
      .filter({ hasText: "Categoría E2E" })
      .first(),
  ).toContainText("1 subcategorías");

  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await expect(
    page.getByRole("option", {
      name: "↳ Subcategoría E2E · no puede ser padre",
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cerrar formulario" }).click();

  await childCategoryRow
    .getByRole("button", { name: "Editar Subcategoría E2E" })
    .click();
  await page.getByLabel("Categoría principal").selectOption("");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect
    .poll(async () => {
      const [row] = await withDatabase(async (sql) =>
        sql<Array<{ parent_category_id: string | null }>>`
          select categories.parent_category_id
          from categories
          inner join category_translations
            on category_translations.category_id = categories.id
          where category_translations.name = 'Subcategoría E2E'
        `,
      );
      return row?.parent_category_id ?? null;
    })
    .toBeNull();

  await page
    .getByRole("button", { name: "Editar Subcategoría E2E" })
    .click();
  await page
    .getByLabel("Categoría principal")
    .selectOption({ label: "Categoría E2E" });
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  await page.getByRole("button", { name: "Eliminar Categoría E2E" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(
    page.getByText(/0 productos asociados y 1 subcategoría/),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Eliminar Subcategoría E2E" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();

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

test("hierarchy is shared by products public detail search and print", async ({
  page,
}) => {
  const fixture = await withDatabase(async (sql) =>
    sql.begin(async (transaction) => {
      const [root] = await transaction<Array<{ id: string }>>`
        insert into categories (sort_order, is_active)
        values (
          (select coalesce(max(sort_order), 0) + 1 from categories where parent_category_id is null),
          true
        )
        returning id
      `;
      const [child] = await transaction<Array<{ id: string }>>`
        insert into categories (parent_category_id, sort_order, is_active)
        values (${root.id}, 1, true)
        returning id
      `;
      await transaction`
        insert into category_translations (category_id, locale, name, description)
        values
          (${root.id}, 'es', 'Vinos E2E', 'Jerarquía E2E'),
          (${child.id}, 'es', 'Vinos tintos E2E', 'Segundo nivel E2E'),
          (${root.id}, 'ca', 'Vins E2E', 'Jerarquia E2E'),
          (${child.id}, 'ca', 'Vins negres E2E', 'Segon nivell E2E')
      `;
      const [product] = await transaction<
        Array<{ id: string; category_id: string }>
      >`
        select products.id, products.category_id
        from products
        inner join product_translations
          on product_translations.product_id = products.id
        where product_translations.locale = 'es'
          and product_translations.name = 'Pizza piccante de muestra'
        limit 1
      `;
      await transaction`
        update products set category_id = ${child.id}, sort_order = 1
        where id = ${product.id}
      `;
      return {
        rootId: root.id,
        childId: child.id,
        productId: product.id,
        originalCategoryId: product.category_id,
      };
    }),
  );

  await loginAsAdmin(page);
  await page.goto("/admin/products");
  const productRow = page
    .getByTestId(/^product-row-/)
    .filter({ hasText: "Pizza piccante de muestra" });
  await productRow
    .getByRole("button", { name: "Editar Pizza piccante de muestra" })
    .click();
  await expect(page.getByLabel("Categoría")).toHaveValue(fixture.childId);
  await expect(
    page.getByLabel("Categoría").getByRole("option", {
      name: "Vinos E2E > Vinos tintos E2E",
    }),
  ).toBeAttached();
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  await page.goto("/es");
  await expect(
    page.getByRole("button", { name: "Vinos E2E · 1" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Vinos tintos E2E/ }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("PÍCCANTE");
  await expect(
    page.getByRole("button", { name: "Vinos E2E · 1" }),
  ).toBeVisible();
  const publicProduct = page
    .locator("article")
    .filter({ hasText: "Pizza piccante de muestra" });
  await publicProduct
    .getByRole("link", { name: "Ver producto", exact: true })
    .click();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb).toContainText("Vinos E2E");
  await expect(breadcrumb).toContainText("Vinos tintos E2E");

  await page.goto("/admin/print-menu");
  const printable = page.locator("[data-print-menu]");
  await expect(printable).toContainText("Vinos E2E");
  await expect(printable).toContainText("Vinos tintos E2E");
  await expect(printable).toContainText("Pizza piccante de muestra");

  const [catalanAvailable] = await withDatabase(async (sql) =>
    sql<Array<{ available: boolean }>>`
      select (
        exists (
          select 1 from restaurant_locales
          where locale = 'ca' and is_published = true
        )
        and exists (
          select 1 from product_translations
          where product_id = ${fixture.productId} and locale = 'ca'
        )
      ) as available
    `,
  );
  if (catalanAvailable?.available) {
    await page.goto("/ca");
    await expect(
      page.getByRole("button", { name: "Vins E2E · 1" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Vins negres E2E/ }),
    ).toBeVisible();
  }

  await page.goto("/admin/qr-code");
  await expect(
    page.getByRole("heading", { name: "Código QR", level: 1 }),
  ).toBeVisible();

  await withDatabase(async (sql) => {
    await sql.begin(async (transaction) => {
      await transaction`
        update products
        set category_id = ${fixture.originalCategoryId}
        where id = ${fixture.productId}
      `;
      await transaction`delete from categories where id = ${fixture.childId}`;
      await transaction`delete from categories where id = ${fixture.rootId}`;
    });
  });
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

  const deleteMilkButton = page.getByRole("button", {
    name: "Eliminar Leche",
  });
  await expect(deleteMilkButton).toBeEnabled();
  await deleteMilkButton.click();
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

  const deleteVegetarianButton = page.getByRole("button", {
    name: "Eliminar Vegetariano",
  });
  await expect(deleteVegetarianButton).toBeEnabled();
  await deleteVegetarianButton.click();
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
  await publicPizza
    .getByRole("link", { name: "Pizza de muestra", exact: true })
    .click();
  const hiddenBlocksDetail = page.getByTestId("product-detail");
  await expect(
    hiddenBlocksDetail.getByRole("button", { name: "Ampliar imagen" }),
  ).toHaveCount(0);
  await expect(
    hiddenBlocksDetail.getByText(
      "Tomate, mozzarella y albahaca usados solo para representar el diseño.",
    ),
  ).toHaveCount(0);
  await expect(
    hiddenBlocksDetail.getByText("Precio", { exact: true }),
  ).toHaveCount(0);
  await expect(
    hiddenBlocksDetail.getByText("Media ración", { exact: true }),
  ).toHaveCount(0);
  await expect(
    hiddenBlocksDetail.getByText("Etiquetas", { exact: true }),
  ).toHaveCount(0);
  await expect(
    hiddenBlocksDetail.getByText("Alérgenos", { exact: true }),
  ).toHaveCount(0);

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

test("customers create reservations and administrators manage them", async ({
  page,
}) => {
  await captureReservationSettingsBackup();
  await cleanupE2EReservations();
  const [bookable] = await withDatabase((sql) => sql<Array<{ date: string }>>`
    with restaurant_today as (
      select id, (current_timestamp at time zone timezone)::date as today
      from restaurant_settings limit 1
    )
    select to_char(day::date, 'YYYY-MM-DD') as date
    from restaurant_today
    cross join lateral
      generate_series(today + 1, today + 30, interval '1 day') generated(day)
    inner join opening_hours
      on opening_hours.restaurant_id = restaurant_today.id
      and opening_hours.day_of_week = extract(isodow from day)::integer
      and opening_hours.is_closed = false
    where not exists (
      select 1 from special_opening_hours
      where special_opening_hours.restaurant_id = restaurant_today.id
        and special_opening_hours.date = day::date
        and special_opening_hours.is_closed = true
    )
    order by day limit 1
  `);
  if (!bookable) throw new Error("No existe una fecha reservable E2E.");

  await loginAsAdmin(page);
  await page.goto("/admin/reservation-settings");
  await page.getByLabel("Activar reservas online").check();
  await page.getByLabel("Duración estimada (minutos)").fill("60");
  await page.getByLabel("Intervalo entre horas").selectOption("60");
  await page.getByLabel("Antelación mínima (minutos)").fill("0");
  await page.getByLabel("Máximo de personas online").fill("6");
  await page.getByLabel("Capacidad por franja").fill("2");
  await page.getByLabel("Mensaje informativo").fill("Reserva online E2E");
  await page
    .getByLabel("Política y condiciones")
    .fill("Política de privacidad E2E.");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(
    page.getByText("Configuración guardada correctamente."),
  ).toBeVisible();

  await page.goto("/es");
  await expect(page.getByRole("link", { name: /Llamar/ }).first()).toBeVisible();
  await page.getByRole("link", { name: "Reservar", exact: true }).click();
  await expect(page).toHaveURL(/\/es\/reservas$/);
  await page.getByLabel("Fecha").fill(bookable.date);
  await page.getByLabel("Personas").fill("2");
  const firstTime = page.locator('input[name="time"]').first();
  await expect(firstTime).toBeAttached();
  const selectedTime = await firstTime.inputValue();
  await firstTime.locator("..").click();
  await page.getByLabel("Nombre").fill("Cliente Reserva E2E");
  await page.getByLabel("Teléfono").fill("+34 600 123 456");
  await page.getByLabel(/Correo electrónico/).fill("reserva-e2e@example.com");
  await page.getByLabel(/Observaciones/).fill("Observación pública E2E");
  await page.getByLabel(/Acepto la política/).check();
  await page.getByRole("button", { name: "Solicitar reserva" }).click();
  await expect(
    page.getByRole("heading", { name: "Reserva enviada correctamente" }),
  ).toBeVisible();
  const locator = (
    await page.getByTestId("reservation-locator").textContent()
  )?.trim();
  expect(locator).toMatch(/^[23456789A-Z]{10}$/);

  await page.goto(`/es/reservas`);
  await page.getByLabel("Fecha").fill(bookable.date);
  await page.getByLabel("Personas").fill("2");
  await expect(
    page.locator(`input[name="time"][value="${selectedTime}"]`),
  ).toHaveCount(0);

  await page.goto(`/admin/reservations?date=${bookable.date}`);
  const reservationCard = page.getByTestId(`reservation-${locator}`);
  await expect(reservationCard).toContainText("Cliente Reserva E2E");
  await expect(reservationCard).toContainText("Pendiente");
  await reservationCard.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Notas internas").fill("Nota interna E2E");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(reservationCard).toContainText("Nota interna E2E");
  await reservationCard.getByRole("button", { name: "Confirmada" }).click();
  await expect(reservationCard).toContainText("Confirmada");
  await page.getByLabel("Buscar").fill(locator ?? "");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByTestId(`reservation-${locator}`)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByTestId(`reservation-${locator}`)
    .getByRole("button", { name: "Cancelada" })
    .click();
  await expect(page.getByTestId(`reservation-${locator}`)).toContainText(
    "Cancelada",
  );

  await page.goto(`/admin/reservations?date=${bookable.date}`);
  await page.getByRole("button", { name: "Reserva manual" }).click();
  await page.getByLabel("Nombre").fill("Reserva Manual E2E");
  await page.getByLabel("Teléfono").fill("+34 600 999 999");
  await page.getByLabel("Hora", { exact: true }).fill("10:00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "fuera de horario" }),
  ).toContainText("fuera de horario");
  await page
    .getByLabel("Continuar si está fuera de horario o supera capacidad")
    .check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Reserva Manual E2E")).toBeVisible();

  await page.goto("/admin/reservation-settings");
  await page.getByLabel("Activar reservas online").uncheck();
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.goto("/es");
  await expect(
    page.getByRole("link", { name: "Reservar", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Llamar/ }).first()).toBeVisible();

  await cleanupE2EReservations();
  await restoreReservationSettingsBackup();
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
  await page.goto("/admin/qr-code");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fqr-code$/);
  await page.goto("/admin/qr");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fqr$/);
  await page.goto("/admin/languages");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Flanguages$/);
  await page.goto("/admin/special-hours");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fspecial-hours$/);
  await page.goto("/admin/reservations");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Freservations$/);
  await page.goto("/admin/reservation-settings");
  await expect(page).toHaveURL(
    /\/login\?next=%2Fadmin%2Freservation-settings$/,
  );
  await page.goto("/admin/print-menu");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fprint-menu$/);
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
  await cleanupE2EReservations();
  await restoreReservationSettingsBackup();
  await cleanupE2ESpecialHours();
  await cleanupE2ELanguages();
  await restoreMenuSettingsBackup();
  await restoreBrandingBackup();
  await cleanupE2EProducts();
  await cleanupE2ETaxonomies();
  await cleanupE2ECategories();
});
