import { en } from "./dictionaries/en";
import { ru } from "./dictionaries/ru";
import type { Dictionary } from "./types";

export const dictionaries = { en, ru } satisfies Record<string, Dictionary>;
