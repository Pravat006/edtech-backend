import moduleAlias from "module-alias";
import path from "path";

import fs from "fs";

type ModuleAliasApi = {
    addAliases: (aliases: Record<string, string>) => void;
};

const distDir = path.join(process.cwd(), "dist");
const basePath = fs.existsSync(distDir) ? "dist" : "src";
const aliasModule = moduleAlias as typeof moduleAlias & ModuleAliasApi;
aliasModule.addAliases({
    "@": path.join(process.cwd(), basePath),
});
