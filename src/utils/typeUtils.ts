// TODO: Use it

// Generic utility to rename keys based on a mapping object
type RenameKeys<T, M extends Record<string, string>> = {
  [K in keyof T as K extends keyof M 
    ? M[K] & string 
    : K]: T[K];
};

// Example
// Your original interface
// interface Product {
//   id: number;
//   cost: number;
//   title: string;
// }

// Define the renaming contract and apply it
// interface NewProduct extends RenameKeys<Product, { cost: 'price'; title: 'name' }> {}

// NewProduct now has: id, price, and name
