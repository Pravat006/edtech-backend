let appInstance;
try {
    appInstance = require("../dist/app").default || require("../dist/app");
} catch {
    require("../src/config/moduleAlias");
    appInstance = require("../src/app").default || require("../src/app");
}

export default appInstance;
