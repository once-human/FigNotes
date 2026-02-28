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

figma.showUI(__html__, { width: 480, height: 840, themeColors: true });

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
                    const result = await SyncService.getState();
                    figma.ui.postMessage({ type: "sync-complete", payload: result });
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

            case "locate-node":
                if (!msg.payload) return;
                try {
                    const nodeToFind = await figma.getNodeByIdAsync(msg.payload);
                    if (nodeToFind) {
                        let page = nodeToFind.parent;
                        while (page && page.type !== "PAGE") {
                            page = page.parent;
                        }
                        if (page) {
                            await figma.setCurrentPageAsync(page as PageNode);
                        }
                        figma.viewport.scrollAndZoomIntoView([nodeToFind]);
                        if (nodeToFind.type !== "PAGE" && nodeToFind.type !== "DOCUMENT") {
                            figma.currentPage.selection = [nodeToFind as SceneNode];
                        }
                    } else {
                        figma.notify("Could not locate element on canvas.");
                    }
                } catch (e) {
                    figma.notify("Could not locate element on canvas.");
                }
                break;

            case "notify":
                figma.notify(msg.payload || "Notification");
                break;

            case "export":
                if (!msg.payload) return;
                const { format, data } = msg.payload;
                if (!data) return;

                let content = "";
                if (format === 'csv') {
                    content = "ID,Message,Page,Frame,Resolved,ResolvedBy,Effort,Age(Days),Avoidance\n";
                    data.tasks.forEach((t: any) => {
                        const safeMsg = t.message.replace(/"/g, '""');
                        content += `${t.commentId},"${safeMsg}",${t.page},${t.frame},${t.resolved},${t.resolvedBy || ''},${t.effort},${t.ageInDays},${t.isAvoidance}\n`;
                    });
                } else {
                    content = `# FigNotes Export\n\n${data.weeklySummary}\n\n`;
                    data.metrics.forEach((m: any) => {
                        content += `## ${m.flowName} - ${m.health} (${Math.round(m.weightedCompletion)}%)\n`;
                        data.tasks.filter((t: any) => t.page === m.flowName).forEach((t: any) => {
                            content += `- [${t.resolved ? 'x' : ' '}] **${t.frame}** (Effort: ${t.effort}, Age: ${t.ageInDays}d): ${t.message}\n`;
                        });
                        content += '\n';
                    });
                }

                figma.ui.postMessage({ type: "export-data", payload: { format, content } });
                break;
        }
    } catch (err: any) {
        console.error("[FigNotes Runtime Error]", err);
        figma.notify("Runtime Error: " + err.message, { error: true });
    }
};

// Initial launch trigger
// We don't auto-sync here anymore because the UI needs to handle the REST fetch using settings.
figma.ui.postMessage({ type: "init", payload: { fileKey: figma.fileKey } });
