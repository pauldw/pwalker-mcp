#!/usr/bin/env tsx

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
// Create server instance
const server = new McpServer({
  name: "pwalker-mcp",
  version: "0.0.6",
});

const taskQueue: string[] = [];

const processes: { [key: string]: ChildProcess } = {};
// Add a new data structure to store process output
const processOutput: { [key: string]: { stdout: string[], stderr: string[], exitCode?: number } } = {};

// Function to clean up all child processes
function cleanupProcesses() {
  console.error("Cleaning up child processes before exit...");
  Object.entries(processes).forEach(([id, process]) => {
    try {
      if (!process.killed) {
        console.error(`Killing process ${id}`);
        process.kill();
      }
    } catch (error) {
      console.error(`Error killing process ${id}:`, error);
    }
  });
}

// Register cleanup handlers for process exit
process.on('SIGINT', () => {
  console.error('Received SIGINT signal');
  cleanupProcesses();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM signal');
  cleanupProcesses();
  process.exit(0);
});

process.on('exit', () => {
  cleanupProcesses();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  cleanupProcesses();
  process.exit(1);
});

//
// Task queue tools
//
server.tool(
  "push-tasks",
  "Push a list of tasks and/or tasks from a taskfile to the task queue. Tasks can be retrieved using the 'pop-task' tool.",
  {
    tasklist: z.array(z.string()).optional().describe("A list of tasks to push to the task queue."),
    taskfile: z.string().optional().describe("Absolute path to a file containing newline-separated tasks to push to the task queue. Use this for long lists of tasks."),
  },
  async (args) => {
    let taskCount = 0;
    if (args.taskfile) {
      const taskfileContent = await fs.promises.readFile(args.taskfile, 'utf-8');
      const tasks = taskfileContent.split("\n").filter(Boolean);
      taskQueue.push(...tasks);
      taskCount += tasks.length;
    } 
    
    if (args.tasklist) {
      taskQueue.push(...args.tasklist);
      taskCount += args.tasklist.length;
    }

    return {
      content: [{
        type: "text",
        text: `Pushed ${taskCount} tasks to the task queue. There are now ${taskQueue.length} tasks in the queue.`
      }]
    };
  }
);

server.tool(
  "pop-task",
  "Pop a task from the task queue. Returns 'No tasks in the queue.' if the queue is empty.",
  {},
  async () => {
    const task = taskQueue.shift();

    if (!task) {
      return {
        content: [{
          type: "text",
          text: "No tasks in the queue."
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `${task}`
      }]
    };
  }
);

//
// Background process tools
// 
server.tool(
  "launch-background-process",
  "Launch a long-running background process with the given command and arguments. This is useful for processes that run continuously and watch for file changes.",
  {
    command: z.string().describe("The long-running command to launch."),
    args: z.array(z.string()).describe("The arguments to pass to the command."),
    cwd: z.string().optional().describe("The working directory in which to execute the command."),
  },
  async ({command, args, cwd}) => {
    const child = spawn(command, args, { cwd });
    const processId = crypto.randomUUID();
    processes[processId] = child;
    // Initialize output storage for this process
    processOutput[processId] = { stdout: [], stderr: [] };
    
    child.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(output);
      processOutput[processId].stdout.push(output);
    });
    child.stderr.on("data", (data) => {
      const output = data.toString();
      console.error(output);
      processOutput[processId].stderr.push(output);
    });
    
    // Clean up process references when they exit
    child.on('exit', (code) => {
      console.error(`Process ${processId} exited with code ${code}`);
      // Store the exit code
      processOutput[processId].exitCode = code !== null ? code : undefined;
      delete processes[processId];
    });
    
    child.on('error', (err) => {
      console.error(`Process ${processId} error:`, err);
      delete processes[processId];
    });

    return {
      content: [{
        type: "text", 
        text: `Process launched successfully. ID: ${processId}`
      }]
    };
  }
);

server.tool(
  "get-process-output",
  "Get the stored stdout and stderr output for a process with the given ID. Also returns the exit code of the process if it has exited.",
  {
    processId: z.string().describe("The ID of the process to get output for."),
    clear: z.boolean().optional().describe("Whether to clear the stored output after retrieving it."),
  },
  async ({processId, clear = false}) => {
    if (!processOutput[processId]) {
      return {
        content: [{
          type: "text",
          text: "Process output not found."
        }]
      };
    }
    
    const stdout = processOutput[processId].stdout.join("");
    const stderr = processOutput[processId].stderr.join("");
    
    // Check if the process is still running
    const isRunning = processes[processId] !== undefined;
    const exitCode = processOutput[processId].exitCode;
    
    let status = isRunning ? "Running" : "Exited";
    if (!isRunning && exitCode !== undefined) {
      status = `Exited with code ${exitCode}`;
    }
    
    if (clear) {
      // Preserve the exit code even when clearing output
      const exitCodeToKeep = processOutput[processId].exitCode;
      processOutput[processId] = { stdout: [], stderr: [], exitCode: exitCodeToKeep };
    }
    
    return {
      content: [{
        type: "text",
        text: `Process ID: ${processId}\nStatus: ${status}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`
      }]
    };
  }
);

server.tool(
  "kill-process",
  "Kill a process with the given ID.",
  {
    processId: z.string().describe("The ID of the process to kill."),
    keepOutput: z.boolean().optional().describe("Whether to keep the stored output after killing the process."),
  },
  async ({processId, keepOutput = false}) => {  
    const process = processes[processId];
    if (!process) {
      return {
        content: [{
          type: "text",
          text: "Process not found."
        }]
      };
    }
    process.kill();
    
    if (!keepOutput) {
      delete processOutput[processId];
    }
    
    return {
      content: [{
        type: "text",
        text: `Process killed successfully. ID: ${processId}`
      }]
    };
  }
);

server.tool(
  "wait",
  "Wait for a specified number of seconds before continuing.",
  {
    seconds: z.number().min(0).describe("The number of seconds to wait."),
  },
  async ({seconds}) => {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return {
      content: [{
        type: "text",
        text: `Waited for ${seconds} seconds.`
      }]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
