export type HierarchicalCategory = {
  id: string;
  parentCategoryId?: string | null;
  sortOrder?: number;
};

export type CategoryHierarchyNode<T extends HierarchicalCategory> = T & {
  children: T[];
};

export type MenuHierarchyBranch<
  TCategory extends HierarchicalCategory,
  TProduct extends { categoryId: string },
> = {
  category: TCategory;
  directProducts: TProduct[];
  subcategories: Array<{
    category: TCategory;
    products: TProduct[];
  }>;
  productCount: number;
};

const byOrder = <T extends HierarchicalCategory>(left: T, right: T) =>
  (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
  left.id.localeCompare(right.id);

export function buildCategoryHierarchy<T extends HierarchicalCategory>(
  categories: T[],
): CategoryHierarchyNode<T>[] {
  const roots = categories
    .filter(({ parentCategoryId }) => parentCategoryId == null)
    .sort(byOrder);
  const rootIds = new Set(roots.map(({ id }) => id));

  return roots.map((root) => ({
    ...root,
    children: categories
      .filter(({ parentCategoryId }) => parentCategoryId === root.id)
      .filter(({ id }) => !rootIds.has(id))
      .sort(byOrder),
  }));
}

export function buildMenuHierarchy<
  TCategory extends HierarchicalCategory,
  TProduct extends { categoryId: string },
>(
  categories: TCategory[],
  products: TProduct[],
): MenuHierarchyBranch<TCategory, TProduct>[] {
  return buildCategoryHierarchy(categories).flatMap((root) => {
    const directProducts = products.filter(
      ({ categoryId }) => categoryId === root.id,
    );
    const subcategories = root.children.flatMap((child) => {
      const childProducts = products.filter(
        ({ categoryId }) => categoryId === child.id,
      );
      return childProducts.length > 0
        ? [{ category: child, products: childProducts }]
        : [];
    });
    const productCount =
      directProducts.length +
      subcategories.reduce((total, child) => total + child.products.length, 0);

    return productCount > 0
      ? [{ category: root, directProducts, subcategories, productCount }]
      : [];
  });
}

export function getCategoryBreadcrumb<T extends HierarchicalCategory>(
  categories: T[],
  categoryId: string,
): T[] {
  const category = categories.find(({ id }) => id === categoryId);
  if (!category) return [];
  if (!category.parentCategoryId) return [category];
  const parent = categories.find(({ id }) => id === category.parentCategoryId);
  return parent ? [parent, category] : [category];
}

export function assertValidCategoryParent<T extends HierarchicalCategory>(
  categories: T[],
  categoryId: string | null,
  parentCategoryId: string | null,
) {
  if (parentCategoryId === null) return;
  if (categoryId === parentCategoryId) {
    throw new Error("Una categoría no puede ser su propio padre.");
  }
  const parent = categories.find(({ id }) => id === parentCategoryId);
  if (!parent) {
    throw new Error("La categoría principal seleccionada no existe.");
  }
  if (parent.parentCategoryId != null) {
    throw new Error("No se permite crear un tercer nivel de categorías.");
  }
  if (
    categoryId &&
    categories.some(({ parentCategoryId: candidateParent }) =>
      candidateParent === categoryId,
    )
  ) {
    throw new Error(
      "Una categoría con subcategorías no puede convertirse en subcategoría.",
    );
  }
}

export function normalizeSiblingOrder<T extends HierarchicalCategory>(
  categories: T[],
): T[] {
  const hierarchy = buildCategoryHierarchy(categories);
  return hierarchy.flatMap((root, rootIndex) => [
    { ...root, sortOrder: rootIndex + 1 },
    ...root.children.map((child, childIndex) => ({
      ...child,
      sortOrder: childIndex + 1,
    })),
  ]);
}

export function getCategoryDeletionBlockers(
  productCount: number,
  childCount: number,
) {
  return {
    productCount,
    childCount,
    canDelete: productCount === 0 && childCount === 0,
  };
}
