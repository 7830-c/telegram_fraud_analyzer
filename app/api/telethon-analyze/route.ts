import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

function runPythonScript(scriptName: string, args: string[], timeout: number = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonBinary = process.env.PYTHON_PATH || "python";
    const pythonPath = path.join(process.cwd());
    const child = spawn(pythonBinary, [scriptName, ...args], {
      cwd: pythonPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || "Python script failed"));
      } else {
        resolve(stdout);
      }
    });

    const timeoutHandle = setTimeout(() => {
      child.kill();
      reject(new Error("Python script timeout"));
    }, timeout);

    child.on("close", () => {
      clearTimeout(timeoutHandle);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone_number, channel_identifier } = body;

    if (!phone_number || !channel_identifier) {
      return NextResponse.json(
        { error: "Missing phone_number or channel_identifier" },
        { status: 400 }
      );
    }

    const result = await runPythonScript(
      "channel_analyzer.py",
      [phone_number, channel_identifier],
      120000 // 2 minute timeout for channel analysis
    );

    const analysisResult = JSON.parse(result);
    return NextResponse.json(analysisResult);
  } catch (error) {
    console.error("Channel analysis error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
