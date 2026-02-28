import { SyncService } from "./syncService";
import { StorageService } from "./storageService";
import { PluginMessage, Task } from "./types";

/**
 * PRODUCTION HARDENING:
 * - Debounced synchronization
 * - Development-only logging
 * - Global error boundaries
 */

const IS_DEV = false; // Toggle for internal logging
function log(...args: any[]) {
    if (IS_DEV) console.log("[FigNotes]", ...args);
}

figma.showUI(__html__, { width: 480, height: 720, themeColors: true });

let isSyncing = false;
let syncTimeout: number | null = null;

async function debouncedSync(rawComments?: any[]) {
    if (isSyncing) return;
    if (syncTimeout) clearTimeout(syncTimeout);

    syncTimeout = setTimeout(async () => {
        isSyncing = true;
        log("Starting sync sequence...");
        try {
            const result = await SyncService.sync(rawComments);
            figma.ui.postMessage({ type: "sync-complete", payload: result });
            log("Sync complete", result);
        } catch (err: any) {
            log("Sync failed", err);
            figma.ui.postMessage({ type: "sync-error", payload: err.message });
            figma.notify("Sync failure: " + err.message, { error: true });
        } finally {
            isSyncing = false;
        }
    }, 200) as unknown as number;
}

figma.ui.onmessage = async (msg: PluginMessage) => {
    log("Message received:", msg.type);

    try {
        switch (msg.type) {
            case "sync":
                await debouncedSync(msg.payload);
                break;

            case "update-task":
                if (!msg.payload || !msg.payload.id) throw new Error("Invalid task update payload");
                const { id, key, value } = msg.payload;

                const tasks = await StorageService.getTasks();
                const task = tasks[id];

                if (task) {
                    log(`Updating task ${id}: ${key} = ${value}`);
                    (task as any)[key] = value;
                    await StorageService.updateTask(task);
                    await debouncedSync();
                }
                break;

            case "save-settings":
                const { pat, fileUrl } = msg.payload;
                await figma.clientStorage.setAsync("figma_pat", pat);
                await figma.clientStorage.setAsync("figma_file_url", fileUrl);
                figma.notify("Settings saved successfully.");
                break;

            case "get-settings":
                const savedPat = await figma.clientStorage.getAsync("figma_pat");
                const savedUrl = await figma.clientStorage.getAsync("figma_file_url");
                figma.ui.postMessage({
                    type: "settings-loaded",
                    payload: { pat: savedPat || "", fileUrl: savedUrl || "" }
                });
                break;

            case "notify":
                figma.notify(msg.payload || "Notification");
                break;

            case "export":
                // Handled by generation logic if needed
                break;
        }
    } catch (err: any) {
        console.error("[FigNotes Runtime Error]", err);
        figma.notify("Runtime Error: " + err.message, { error: true });
    }
};

// Initial launch trigger
// We don't auto-sync here anymore because the UI needs to handle the REST fetch using settings.
figma.ui.postMessage({ type: "init" });
