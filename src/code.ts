import { SyncService } from "./syncService";
import { StorageService } from "./storageService";
import { PluginMessage, Task } from "./types";

figma.showUI(__html__, { width: 550, height: 800, themeColors: true });

async function performSync() {
    try {
        const result = await SyncService.sync();
        figma.ui.postMessage({ type: "sync-complete", payload: result });
    } catch (err: any) {
        figma.notify("Sync Error: " + err.message, { error: true });
    }
}

figma.ui.onmessage = async (msg: PluginMessage) => {
    switch (msg.type) {
        case "sync":
            await performSync();
            break;

        case "update-task":
            try {
                const { id, key, value } = msg.payload;
                const tasks = await StorageService.getTasks();
                const task = tasks[id];

                if (task) {
                    (task as any)[key] = value;
                    await StorageService.updateTask(task);
                    await performSync();
                }
            } catch (err: any) {
                figma.notify("Update Error: " + err.message, { error: true });
            }
            break;

        case "export":
            const { format, data } = msg.payload;
            if (format === 'markdown') {
                const md = generateMarkdown(data);
                figma.ui.postMessage({ type: 'export-data', payload: { format: 'md', content: md } });
            } else if (format === 'csv') {
                const csv = generateCSV(data.tasks);
                figma.ui.postMessage({ type: 'export-data', payload: { format: 'csv', content: csv } });
            }
            break;

        case "notify":
            figma.notify(msg.payload);
            break;
    }
};

function generateMarkdown(data: any): string {
    let md = "# FigNotes Design Execution Summary\n\n";
    md += `## Weekly Summary\n${data.weeklySummary}\n\n`;
    md += "## Flow Metrics\n| Flow | Completion | Tasks | Effort |\n| :--- | :--- | :--- | :--- |\n";
    data.metrics.forEach((m: any) => {
        md += `| ${m.flowName} | ${Math.round(m.weightedCompletion)}% | ${m.resolvedTasks}/${m.totalTasks} | ${m.completedEffort}/${m.totalEffort} |\n`;
    });
    return md;
}

function generateCSV(tasks: Task[]): string {
    const header = "commentId,message,page,frame,resolved,effort,discussionStatus,createdAt\n";
    const rows = tasks.map(t =>
        `"${t.commentId}","${t.message.replace(/"/g, '""')}","${t.page}","${t.frame}",${t.resolved},${t.effort},"${t.discussionStatus}","${t.createdAt}"`
    ).join("\n");
    return header + rows;
}

performSync();
