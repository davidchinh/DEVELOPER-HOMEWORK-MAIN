import {
  GetRecipes,
  GetProductsForIngredient,
  GetUnitsData,
  GetBaseUoM
} from "./supporting-files/data-access";
import {
  GetCostPerBaseUnit,
  GetNutrientFactInBaseUnits
} from "./supporting-files/helpers";
import {
  Recipe,
  RecipeLineItem,
  Product,
  SupplierProduct,
  UnitOfMeasure,
  UoMName,
  UoMType,
  NutrientFact
} from "./supporting-files/models";
import { RunTest, ExpectedRecipeSummary } from "./supporting-files/testing";

console.clear();
console.log("Expected Result Is:", ExpectedRecipeSummary);

const recipeData = GetRecipes(); // the list of 1 recipe you should calculate the information for
console.log("Recipe Data:", recipeData);
let recipeSummary: any = {}; // the final result to pass into the test function
/*
 * YOUR CODE GOES BELOW THIS, DO NOT MODIFY ABOVE
 * (You can add more imports if needed)
 * */


/**
 * Performs a breadth-first search (BFS) on the available conversions to find a path from one unit to another.
 * 
 * 
 * @param fromUoM - The source UnitOfMeasure
 * @param toUoMName - The target UoMName
 * @param toUoMType - The target UoMType
 * @returns A new UnitOfMeasure representing the converted quantity
 */
const ConvertUnitsMultiStep = (
  fromUoM: UnitOfMeasure,
  toUoMName: UoMName,
  toUoMType: UoMType
): UnitOfMeasure => {
  if (fromUoM.uomName === toUoMName && fromUoM.uomType === toUoMType) {
    return { ...fromUoM };
  }

  const conversions = GetUnitsData();

  // BFS queue stores the current node key and the factor so far
  const fromKey = `${fromUoM.uomName}|${fromUoM.uomType}`;
  const toKey = `${toUoMName}|${toUoMType}`;
  const queue: Array<{ key: string; factor: number }> = [
    { key: fromKey, factor: 1 }
  ];
  const visited = new Set<string>([fromKey]);
  const parentMap = new Map<string, { parent: string; convFactor: number }>();
  parentMap.set(fromKey, { parent: "", convFactor: 1 });

  // BFS to find a path from fromKey to toKey
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.key === toKey) {
      let totalFactor = 1;
      let node = toKey;
      while (true) {
        const data = parentMap.get(node);
        if (!data) break;
        totalFactor *= data.convFactor;
        if (!data.parent) break;
        node = data.parent;
      }
      return {
        uomAmount: fromUoM.uomAmount * totalFactor,
        uomName: toUoMName,
        uomType: toUoMType
      };
    }

    const [curName, curType] = current.key.split("|");
    for (const c of conversions) {
      if (c.fromUnitName === curName && c.fromUnitType === curType) {
        const nextKey = `${c.toUnitName}|${c.toUnitType}`;
        if (!visited.has(nextKey)) {
          visited.add(nextKey);
          parentMap.set(nextKey, {
            parent: current.key,
            convFactor: c.conversionFactor
          });
          queue.push({ key: nextKey, factor: current.factor * c.conversionFactor });
        }
      }
    }
  }

  throw new Error(
    `Couldn't convert ${fromUoM.uomName} (${fromUoM.uomType}) to ${toUoMName} (${toUoMType})`
  );
}

/**
 * Finds the cheapest supplier product for an ingredient.
 *
 * @param products - Array of products matching an ingredient.
 * @returns An object contain the choice product, supplier, and the cost per base unit.
 */
const FindCheapestSupplier = (products: Product[]): {
  cheapestProduct: Product;
  cheapestSupplier: SupplierProduct;
  cheapestCostPerUnit: number;
} => {
  let cheapestSupplier: SupplierProduct | null = null;
  let cheapestProduct: Product | null = null;
  let cheapestCostPerUnit = Infinity;

  for (const prod of products) {
    for (const supplier of prod.supplierProducts) {
      const costPerBase = GetCostPerBaseUnit(supplier);
      if (costPerBase < cheapestCostPerUnit) {
        cheapestCostPerUnit = costPerBase;
        cheapestSupplier = supplier;
        cheapestProduct = prod;
      }
    }
  }

  if (!cheapestSupplier || !cheapestProduct) {
    throw new Error("No suppliers found for these products.");
  }

  return { cheapestProduct, cheapestSupplier, cheapestCostPerUnit };
}

/**
 * Converts the required measure for a line item into the base unit of the choice supplier product,
 * then calculates and returns the cost for that ingredient.
 *
 * @param lineItem - The recipe line item.
 * @param cheapestSupplier - The choice supplier product.
 * @param cheapestCostPerUnit - The cost per base unit for the choice supplier product.
 * @returns The cost for the given line item.
 */
const CalculateLineItemCost = ( 
  lineItem: RecipeLineItem,
  cheapestSupplier: SupplierProduct,
  cheapestCostPerUnit: number
): number => {
  const baseUoM = GetBaseUoM(cheapestSupplier.supplierProductUoM.uomType);
  const convertedRequired = ConvertUnitsMultiStep(
    lineItem.unitOfMeasure,
    baseUoM.uomName,
    baseUoM.uomType
  );
  return convertedRequired.uomAmount * cheapestCostPerUnit;
}

/**
 * Aggregates the nutrient facts for a choice product into a global nutrient map.
 *
 * @param globalNutrientMap - The global map for nutrients.
 * @param product - The choice product whose nutrient facts will be added.
 */
const AggregateNutrients = (
  globalNutrientMap: Record<string, NutrientFact>,
  product: Product
): void => {
  product.nutrientFacts.forEach((nf) => {
    const baseNf = GetNutrientFactInBaseUnits(nf);
    const nName = baseNf.nutrientName;
    if (!globalNutrientMap[nName]) {
      globalNutrientMap[nName] = {
        nutrientName: nName,
        quantityAmount: { ...baseNf.quantityAmount },
        quantityPer: { ...baseNf.quantityPer }
      };
    } else {
      globalNutrientMap[nName].quantityAmount.uomAmount += baseNf.quantityAmount.uomAmount;
    }
  });
}

/**
 * Processes an array of recipes and returns a summary object.
 * 
 * @param recipes - An array of Recipe objects.
 * @returns A record where each key is a recipe name and the value is calculate summary.
 */
const CalculateRecipeSummary = (recipes: Recipe[]): Record<string, any> => {
  // Expected nutrient order.
  const defaultNutrientOrder = ["Carbohydrates", "Fat", "Protein", "Sodium"];
  const summary: Record<string, any> = {};

  recipes.forEach((recipe: Recipe) => {
    let totalCostForRecipe = 0;
    const nutrientMapForRecipe: Record<string, NutrientFact> = {};

    recipe.lineItems.forEach((lineItem: RecipeLineItem) => {
      const products: Product[] = GetProductsForIngredient(lineItem.ingredient);
      if (!products.length) {
        throw new Error(
          `No products found for ingredient: ${lineItem.ingredient.ingredientName}`
        );
      }

      const { cheapestProduct, cheapestSupplier, cheapestCostPerUnit } = FindCheapestSupplier(products);
      totalCostForRecipe += CalculateLineItemCost(lineItem, cheapestSupplier, cheapestCostPerUnit);
      AggregateNutrients(nutrientMapForRecipe, cheapestProduct);
    });

    // Build an ordered nutrient object based on the default order.
    const orderedNutrients: Record<string, NutrientFact> = {};
    defaultNutrientOrder.forEach(nutrientKey => {
      if (nutrientMapForRecipe[nutrientKey]) {
        orderedNutrients[nutrientKey] = nutrientMapForRecipe[nutrientKey];
      }
    });

    summary[recipe.recipeName] = {
      cheapestCost: totalCostForRecipe,
      nutrientsAtCheapestCost: orderedNutrients
    };
  });

  return summary;
};

recipeSummary = CalculateRecipeSummary(recipeData);
console.log("Final Recipe Summary:", JSON.stringify(recipeSummary, null, 2));
/*
 * YOUR CODE ABOVE THIS, DO NOT MODIFY BELOW
 * */
RunTest(recipeSummary);