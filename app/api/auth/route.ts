import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

function runPythonScript(scriptName: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonBinary = process.env.PYTHON_PATH || "python";
    console.log("[auth route] using python binary:", pythonBinary);
    const pythonPath = path.join(process.cwd());
    
    // Pass environment variables to subprocess
    const env = {
      ...process.env,
      TELEGRAM_API_ID: process.env.TELEGRAM_API_ID,
      TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH,
    };
    
    const child = spawn(pythonBinary, [scriptName, ...args], {
      cwd: pythonPath,
      stdio: ["pipe", "pipe", "pipe"],
      env: env,
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

    setTimeout(() => {
      child.kill();
      reject(new Error("Python script timeout"));
    }, 30000); // 30 second timeout
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, phone_number, otp_code, password } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Missing 'action' parameter" },
        { status: 400 }
      );
    }

    if (action === "request_otp") {
      const result = await runPythonScript("auth_handler.py", [
        action,
        phone_number,
      ]);
      return NextResponse.json(JSON.parse(result));
    }

    if (action === "verify_otp") {
      const { phone_code_hash } = body;
      const args = [
        action,
        phone_number,
        otp_code,
      ];
      if (phone_code_hash) {
        args.push(phone_code_hash);
      }
      const result = await runPythonScript("auth_handler.py", args);
      return NextResponse.json(JSON.parse(result));
    }

    if (action === "verify_password") {
      const result = await runPythonScript("auth_handler.py", [
        action,
        phone_number,
        password,
      ]);
      return NextResponse.json(JSON.parse(result));
    }

    if (action === "check_auth") {
      const result = await runPythonScript("auth_handler.py", [
        action,
        phone_number,
      ]);
      return NextResponse.json(JSON.parse(result));
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Auth API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
