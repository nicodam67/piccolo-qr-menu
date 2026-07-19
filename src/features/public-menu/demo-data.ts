import type { DemoMenu } from "./types";

/**
 * DATOS EXCLUSIVAMENTE DEMOSTRATIVOS.
 *
 * Ningún teléfono, dirección, horario, producto, precio, alérgeno, etiqueta o
 * imagen de este archivo debe interpretarse como información oficial de
 * Piccolo La Ràpita. Se reemplazarán por datos validados en una entrega futura.
 */
export const demoMenu: DemoMenu = {
  restaurant: {
    name: "Piccolo La Ràpita",
    slogan: "Cocina con sabor italiano",
    phoneDisplay: "+34 900 000 000 · DEMO",
    phoneHref: "tel:+34900000000",
    address: "Dirección de demostración · La Ràpita",
    heroImageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=85",
    heroImageAlt:
      "Interior de restaurante usado únicamente como imagen de demostración",
  },
  locale: "es",
  timeZone: "Europe/Madrid",
  categories: [
    { id: "antipasti", name: "Antipasti", eyebrow: "Para comenzar · demo" },
    { id: "pizze", name: "Pizze", eyebrow: "Masa artesana · demo" },
    { id: "pasta", name: "Pasta", eyebrow: "Recetas de muestra · demo" },
    { id: "dolci", name: "Dolci", eyebrow: "Un final dulce · demo" },
  ],
  products: [
    {
      id: "demo-burrata",
      categoryId: "antipasti",
      name: "Burrata de muestra",
      description:
        "Composición visual de tomate, burrata y albahaca. Descripción no oficial.",
      imageUrl:
        "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85",
      imageAlt: "Plato italiano de demostración con vegetales",
      fullPrice: 12.5,
      tags: [{ label: "Vegetariano", tone: "green" }],
      allergens: ["Leche"],
    },
    {
      id: "demo-focaccia",
      categoryId: "antipasti",
      name: "Focaccia de muestra",
      description:
        "Pan aromático presentado como contenido provisional para revisar la tarjeta.",
      imageUrl:
        "https://images.unsplash.com/photo-1573140401552-3fab0b24306f?auto=format&fit=crop&w=1200&q=85",
      imageAlt: "Pan italiano utilizado como fotografía de demostración",
      fullPrice: 7.9,
      tags: [{ label: "Vegano", tone: "green" }],
      allergens: ["Gluten"],
      isSoldOut: true,
    },
    {
      id: "demo-margherita",
      categoryId: "pizze",
      name: "Pizza de muestra",
      description:
        "Tomate, mozzarella y albahaca usados solo para representar el diseño.",
      imageUrl:
        "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=85",
      imageAlt: "Pizza de demostración con tomate y albahaca",
      fullPrice: 11.8,
      halfPrice: 7.2,
      tags: [{ label: "Vegetariano", tone: "green" }],
      allergens: ["Gluten", "Leche"],
    },
    {
      id: "demo-piccante",
      categoryId: "pizze",
      name: "Pizza piccante de muestra",
      description:
        "Una combinación ficticia para mostrar etiquetas y alérgenos en el prototipo.",
      imageUrl:
        "https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=1200&q=85",
      imageAlt: "Pizza picante usada como imagen de demostración",
      fullPrice: 14.2,
      tags: [{ label: "Picante", tone: "red" }],
      allergens: ["Gluten", "Leche"],
    },
    {
      id: "demo-tagliatelle",
      categoryId: "pasta",
      name: "Tagliatelle de muestra",
      description:
        "Pasta y salsa ilustrativas; el plato y su precio no pertenecen a la carta real.",
      imageUrl:
        "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=85",
      imageAlt: "Pasta italiana presentada como contenido de demostración",
      fullPrice: 15.4,
      halfPrice: 9.5,
      tags: [{ label: "Receta demo", tone: "gold" }],
      allergens: ["Gluten", "Huevo", "Leche"],
    },
    {
      id: "demo-tiramisu",
      categoryId: "dolci",
      name: "Postre de muestra",
      description:
        "Presentación ficticia para validar el aspecto de la sección de postres.",
      imageUrl:
        "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=85",
      imageAlt: "Postre italiano utilizado como fotografía de demostración",
      fullPrice: 6.8,
      tags: [{ label: "Demo", tone: "gold" }],
      allergens: ["Gluten", "Huevo", "Leche"],
    },
  ],
  openingHours: [
    {
      day: "monday",
      label: "Lunes",
      periods: [],
    },
    {
      day: "tuesday",
      label: "Martes",
      periods: [
        { opensAt: "13:00", closesAt: "16:00" },
        { opensAt: "19:30", closesAt: "23:00" },
      ],
    },
    {
      day: "wednesday",
      label: "Miércoles",
      periods: [
        { opensAt: "13:00", closesAt: "16:00" },
        { opensAt: "19:30", closesAt: "23:00" },
      ],
    },
    {
      day: "thursday",
      label: "Jueves",
      periods: [
        { opensAt: "13:00", closesAt: "16:00" },
        { opensAt: "19:30", closesAt: "23:00" },
      ],
    },
    {
      day: "friday",
      label: "Viernes",
      periods: [
        { opensAt: "13:00", closesAt: "16:00" },
        { opensAt: "19:30", closesAt: "00:30" },
      ],
    },
    {
      day: "saturday",
      label: "Sábado",
      periods: [
        { opensAt: "13:00", closesAt: "16:00" },
        { opensAt: "19:30", closesAt: "00:30" },
      ],
    },
    {
      day: "sunday",
      label: "Domingo",
      periods: [
        { opensAt: "13:00", closesAt: "16:00" },
        { opensAt: "19:30", closesAt: "23:00" },
      ],
    },
  ],
};
