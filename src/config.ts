import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-codenames",
  description: "Codenames — shared 5x5 word grid with a private spymaster key, on every phone",
  accentHex: "#7b6ef6",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
