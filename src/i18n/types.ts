import type { en } from "./dictionaries/en";
import type { dictionaries } from "./registry";

export type Locale = keyof typeof dictionaries;
export type Dictionary = typeof en;
