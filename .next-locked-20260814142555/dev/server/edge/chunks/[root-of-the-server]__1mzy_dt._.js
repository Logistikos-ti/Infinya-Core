(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push(["chunks/[root-of-the-server]__1mzy_dt._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/src/lib/env.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAppEnv",
    ()=>getAppEnv,
    "getBlingEnv",
    ()=>getBlingEnv,
    "getMercadoLivreEnv",
    ()=>getMercadoLivreEnv,
    "getSupabaseEnv",
    ()=>getSupabaseEnv,
    "hasSupabaseEnv",
    ()=>hasSupabaseEnv
]);
function getSupabaseEnv() {
    return {
        url: ("TURBOPACK compile-time value", "https://brevhcwdhqyjqseduwpb.supabase.co") ?? "",
        anonKey: ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMTkwMTEsImV4cCI6MjA5Njg5NTAxMX0.yQndH3K1i3MUSJ7NoZHllXXVZWJgIax7ajJHhn9dxlQ") ?? "",
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    };
}
function hasSupabaseEnv() {
    const env = getSupabaseEnv();
    return Boolean(env.url && env.anonKey);
}
function getAppEnv() {
    return {
        publicAppUrl: ("TURBOPACK compile-time value", "http://localhost:3000")?.trim() ?? ""
    };
}
function getBlingEnv() {
    return {
        clientId: process.env.BLING_CLIENT_ID?.trim() ?? "",
        clientSecret: process.env.BLING_CLIENT_SECRET?.trim() ?? ""
    };
}
function getMercadoLivreEnv() {
    return {
        clientId: process.env.MERCADO_LIVRE_CLIENT_ID?.trim() ?? "",
        clientSecret: process.env.MERCADO_LIVRE_CLIENT_SECRET?.trim() ?? ""
    };
}
}),
"[project]/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "middleware",
    ()=>middleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/server/web/spec-extension/response.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/env.ts [middleware-edge] (ecmascript)");
;
;
;
async function middleware(request) {
    let response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next({
        request: {
            headers: request.headers
        }
    });
    const env = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["getSupabaseEnv"])();
    if (!env.url || !env.anonKey) {
        return response;
    }
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["createServerClient"])(env.url, env.anonKey, {
        cookies: {
            getAll () {
                return request.cookies.getAll();
            },
            setAll (cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options })=>request.cookies.set(name, value));
                response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next({
                    request: {
                        headers: request.headers
                    }
                });
                cookiesToSet.forEach(({ name, value, options })=>response.cookies.set(name, value, options));
            }
        }
    });
    await supabase.auth.getUser();
    return response;
}
const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)"
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__1mzy_dt._.js.map