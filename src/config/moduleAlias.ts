import moduleAlias from "module-alias";
import path from "path";

type ModuleAliasApi = {
    addAliases: (aliases: Record<string, string>) => void;
};

const basePath = process.env.NODE_ENV === "production" ? "dist" : "src";
const aliasModule = moduleAlias as typeof moduleAlias & ModuleAliasApi;
aliasModule.addAliases({
    "@": path.join(process.cwd(), basePath),
});
