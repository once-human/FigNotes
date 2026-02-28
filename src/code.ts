import { SyncService } from "./syncService";
import { StorageService } from "./storageService";
import { PluginMessage, Task } from "./types";

/**
 * FigNotes: Design Review Command Center
 */

figma.showUI(__html__, { width: 480, height: 840, themeColors: true });

async function broadcastState(rawComments?: any[]) {
    try {
        const result = rawComments
            ? await SyncService.sync(rawComments)
            : await SyncService.getState();
        figma.ui.postMessage({ type: "sync-complete", payload: result });
    } catch (err: any) {
        figma.ui.postMessage({ type: "sync-error", payload: err.message });
        figma.notify("Sync failure: " + err.message, { error: true });
    }
}

figma.ui.onmessage = async (msg: PluginMessage) => {
    try {
        switch (msg.type) {
            case "sync":
                await broadcastState(msg.payload);
                break;

            case "update-task":
                if (!msg.payload || !msg.payload.id) throw new Error("Invalid task update payload");
                const { id, key, value } = msg.payload;
                const tasks = await StorageService.getTasks();
                const task = tasks[id];
                if (task) {
                    (task as any)[key] = value;
                    await StorageService.updateTask(task);
                    await broadcastState();
                }
                break;

            case "bulk-update":
                if (!msg.payload || !msg.payload.ids) throw new Error("Invalid bulk update payload");
                const { ids, updates } = msg.payload;
                const allTasks = await StorageService.getTasks();
                for (const taskId of ids) {
                    if (allTasks[taskId]) {
                        Object.assign(allTasks[taskId], updates);
                    }
                }
                await StorageService.saveTasks(allTasks);
                await broadcastState();
                break;

            case "focus-mode":
                const state = await SyncService.getState();
                const focusTask = SyncService.getFocusTask(state.tasks, null);
                if (focusTask) {
                    figma.ui.postMessage({ type: "focus-task-found", payload: focusTask });
                } else {
                    figma.notify("No actionable focus tasks found.");
                }
                break;

            case "save-settings":
                await figma.clientStorage.setAsync("figma_pat", msg.payload.pat);
                await figma.clientStorage.setAsync("figma_file_url", msg.payload.fileUrl);
                figma.notify("Settings saved.");
                break;

            case "get-settings":
                const pat = await figma.clientStorage.getAsync("figma_pat");
                const url = await figma.clientStorage.getAsync("figma_file_url");
                figma.ui.postMessage({ type: "settings-loaded", payload: { pat, fileUrl: url } });
                break;

            case "locate-node":
                if (!msg.payload) return;
                const node = await figma.getNodeByIdAsync(msg.payload);
                if (node) {
                    let page = node.parent;
                    while (page && page.type !== "PAGE") page = page.parent;
                    if (page) await figma.setCurrentPageAsync(page as PageNode);

                    figma.viewport.scrollAndZoomIntoView([node]);
                    if (node.type !== "PAGE" && node.type !== "DOCUMENT") {
                        figma.currentPage.selection = [node as SceneNode];
                    }
                } else {
                    figma.notify("Node not found on canvas.");
                }
                break;

            case "export":
                const { format, data } = msg.payload;
                let content = "";
                if (format === 'csv') {
                    content = "ID,Message,Author,Status,Priority,Estimate,Page,Frame\n";
                    data.tasks.forEach((t: any) => {
                        content += `${t.commentId},"${t.message.replace(/"/g, '""')}",${t.author},${t.internalStatus},${t.priority},${t.timeEstimateMinutes},${t.page},${t.frame}\n`;
                    });
                } else {
                    content = `# Design Review Executive Summary\n\n${data.weeklySummary}\n\n`;
                    data.tasks.forEach((t: any) => {
                        content += `### [${t.internalStatus}] ${t.message.substring(0, 50)}...\n`;
                        content += `- **Priority**: ${t.priority} | **Time**: ${t.timeEstimateMinutes}m | **Assigned**: ${t.assignee || 'Unassigned'}\n`;
                        content += `- **Location**: ${t.page} / ${t.frame}\n\n`;
                    });
                }
                figma.ui.postMessage({ type: "export-data", payload: { format, content } });
                break;
        }
    } catch (err: any) {
        figma.notify("Runtime Error: " + err.message, { error: true });
    }
};

figma.ui.postMessage({ type: "init", payload: { fileKey: figma.fileKey } });
