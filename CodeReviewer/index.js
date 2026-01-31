import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import readlineSync from "readline-sync";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// TOOLS FUNCTIONS

async function listFiles({ directory }) {
    const files = [];
    const extensions = [".js", ".json", ".css", ".html", ".txt", ".jsx", ".ts", ".tsx"];

    function scanDirectory(dir) {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);

            // skip node_modules, build, dist, .gitignore
            if(fullPath.includes("node_modules") || fullPath.includes("build") || fullPath.includes("dist") || fullPath.includes(".gitignore")) {
                continue;
            }

            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scanDirectory(fullPath);
            }
            else if (extensions.includes(path.extname(item))) {
                files.push(fullPath);
            }
        }
    }
    scanDirectory(directory);
    return {files};
}

async function readFile({ filepath }) {
  const content = fs.readFileSync(filepath, "utf-8");
  return {content};
}

async function writeFile({ filepath, content }) {
    fs.writeFileSync(filepath, content, "utf-8");
    console.log(`File written: ${filepath}`);
    return {success: true};
} 

// TOOL REGISTRATION    

const tools = {
    listFiles,
    readFile,
    writeFile
}

// TOOL DECLARATIONS

const listFilesTool = {
    name: "listFiles",
    description: "List all files in a directory",
    parameters: {
        type: Type.OBJECT,
        properties: {
            directory: {
                type: Type.STRING,
                description: "Directory to list files from",
            },
        },
        required: ["directory"],
    },
}

const readFileTool = {
    name: "readFile",
    description: "Read the content of a file",
    parameters: {
        type: Type.OBJECT,
        properties: {
            filepath: {
                type: Type.STRING,
                description: "Path to the file to read",
            },
        },
        required: ["filepath"],
    },
}

const writeFileTool = {
    name: "writeFile",
    description: "Write content to a file",
    parameters: {
        type: Type.OBJECT,
        properties: {
            filepath: {
                type: Type.STRING,
                description: "Path to the file to write",
            },
            content: {
                type: Type.STRING,
                description: "Content to write to the file",
            },
        },
        required: ["filepath", "content"],
    },
}

// MAIN FUNCTION

export async function runAgent({directory}) {
    console.log("\n🚀 Starting Code Review Agent...");
    console.log(`\n🔍 Scanning directory: ${directory}`);

    const History = [{
        role: "user",
        parts: [{
            text: `You are a code reviewer. Review the code in the directory: ${directory}`
        }]
    }];

    while(true) {
        const result = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: History,
            config: {
                systemInstruction: `
                You are a code reviewer and fixer. Review the code in the directory: ${directory} and fix the issues.
                - Use listFiles to get all the html, css, javascript, jsx, ts, tsx files in the directory.
                - Use readFile to read each content of the files.
                - Analyze the code and identify issues.
                  **HTML ISSUES:**
                   - Missing doctype, meta tags, semantic HTML
                   - Broken links
                   - Missing alt tags
                   - Accessibility issues
                   - Inline styles
                   - Poor SEO
                  **CSS ISSUES:**
                   - Syntax errors
                   - Inefficient selectors
                   - Poor organization
                   - Invalid properties
                   - Browser compatibility issues
                   - Poor performance
                   - Unused or duplicate CSS

                  **JAVASCRIPT ISSUES:**
                   - Syntax errors
                   - Inefficient code
                   - BUGS: null/undefined errors, missing returns, type errors, async/await issues
                   - CODE QUALITY: console.logs, unused code, bad naming, complex logic

                - use writeFile to fix the issues.(write correct code)
                - After fixing all files, respond with a summary report in TEXT format.

                **SUMMARY REPORT FORMAT**
                - CODE REVIEW COMPLETED

                Total files analysed: X
                Issues found: Y
                Fixed files: Z

                SECURITY FIXES:
                - Remove hardcoded API keys
                - Add input validation
                - Implement proper error handling
                - Add rate limiting
                - Use HTTPS
                - Add proper authentication and authorization

                BUG FIXES:
                - Remove null/undefined errors
                - Add missing returns
                - Fix type errors
                - Fix async/await issues

                CODE QUALITY FIXES:
                - Remove console.logs
                - Remove unused code
                - Fix bad naming
                - Fix complex logic

              Be practical and focus on real issues. Actually fix the issues and make the code better. Don't just say you fixed it. 
                
                `,
                tools: [listFilesTool, readFileTool, writeFileTool],
            }
        });
    }

} 




