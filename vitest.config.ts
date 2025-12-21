import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: ["**/*.test.ts"],
        exclude: ["node_modules", ".next"],
        setupFiles: ["./vitest.setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["lib/components/**/*.ts"],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./"),
        },
    },
})
