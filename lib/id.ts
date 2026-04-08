import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 8);

export function createId(prefix: string) {
  return `${prefix}_${nanoid()}`;
}
