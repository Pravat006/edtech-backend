import moduleAlias from "module-alias";
import path from "path";

import fs from "fs";

type ModuleAliasApi = {
    addAliases: (aliases: Record<string, string>) => void;
};

const isVercel = process.env.VERCEL === "1" || Boolean(process.env.NOW_REGION);
const distApp = path.join(process.cwd(), "dist", "app.js");
const basePath = (!isVercel && fs.existsSync(distApp)) ? "dist" : "src";

const aliasModule = moduleAlias as typeof moduleAlias & ModuleAliasApi;
aliasModule.addAliases({
    "@": path.join(process.cwd(), basePath),
});
