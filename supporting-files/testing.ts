export const ExpectedRecipeSummary: any = {
    "Creme Brulee": {
        cheapestCost: 7.131584999999999,
        nutrientsAtCheapestCost: {
            Carbohydrates: {
                nutrientName: "Carbohydrates",
                quantityAmount: {
                    uomAmount: 106.1,
                    uomName: "grams",
                    uomType: "mass",
                },
                quantityPer: {
                    uomAmount: 100,
                    uomName: "grams",
                    uomType: "mass",
                },
            },
            Fat: {
                nutrientName: "Fat",
                quantityAmount: {
                    uomAmount: 35,
                    uomName: "grams",
                    uomType: "mass",
                },
                quantityPer: {
                    uomAmount: 100,
                    uomName: "grams",
                    uomType: "mass",
                },
            },
            Protein: {
                nutrientName: "Protein",
                quantityAmount: {
                    uomAmount: 17.2,
                    uomName: "grams",
                    uomType: "mass",
                },
                quantityPer: {
                    uomAmount: 100,
                    uomName: "grams",
                    uomType: "mass",
                },
            },
            Sodium: {
                nutrientName: "Sodium",
                quantityAmount: {
                    uomAmount: 0.001,
                    uomName: "grams",
                    uomType: "mass",
                },
                quantityPer: {
                    uomAmount: 100,
                    uomName: "grams",
                    uomType: "mass",
                },
            },
        },
    },
};

export function RunTest(inputRecipeSummary: any) {
    for (const recipeName of Object.keys(ExpectedRecipeSummary)) {
        try {
            const expectedObj = ExpectedRecipeSummary[recipeName];
            const receivedObj = inputRecipeSummary[recipeName];

            const expected = JSON.stringify(expectedObj, null, 2);
            const received = JSON.stringify(receivedObj, null, 2);

            console.log(
                `CHECKING RECIPE "${recipeName}" --- ${
                    expected !== received ? "IN" : ""
                }CORRECT ANSWER`
            );
        } catch (error) {
            console.log("THREW ERROR --- INCORRECT ANSWER");
        }
    }
}

