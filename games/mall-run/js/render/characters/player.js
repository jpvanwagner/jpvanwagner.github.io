/* The runner's look, from the title-screen choices (used by the game view and the preview). */
import { HEIGHTS, BUILDS } from "../../config.js";

export function playerAppearance(P) {
  const h = (HEIGHTS.find(o => o.v === P.height) || HEIGHTS[1]).h;
  const g = (BUILDS.find(o => o.v === P.build) || BUILDS[1]).g;
  return {
    build: P.look === "b" ? "b" : "a", height: h * (P.look === "b" ? 0.97 : 1), girth: g,
    skin: P.skin || "#e8b98c", hair: P.hair || "#3a2a1c", hairStyle: P.hairStyle || "short", capColor: P.pants,
    shirt: P.shirt, shirtStyle: "tee", pants: P.pants, legStyle: "pants", shoes: "#f4f1ea", backpack: null, bag: null
  };
}
