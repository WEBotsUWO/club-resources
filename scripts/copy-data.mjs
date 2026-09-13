import { copyFile } from "node:fs/promises";

for (const club of ["webots", "chrc"]) {
  await copyFile(
    `${club}/org-structure/chart.json`,
    `dist/${club}/org-structure/chart.json`,
  );
}
