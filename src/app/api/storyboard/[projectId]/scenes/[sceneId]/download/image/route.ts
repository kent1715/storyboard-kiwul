import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";

  return "application/octet-stream";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const { searchParams } = new URL(request.url);

    const file = searchParams.get("file");

    if (!file) {
      return NextResponse.json(
        { error: "Missing file query parameter" },
        { status: 400 }
      );
    }

    const safeFile = path.basename(file);

    const baseDir = path.join(
      process.cwd(),
      "outputs",
      "storyboard",
      projectId,
      "images"
    );

    const filePath = path.join(baseDir, safeFile);

    if (!filePath.startsWith(baseDir)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        {
          error: "Image file not found",
          file: safeFile,
          expected_path: filePath
        },
        { status: 404 }
      );
    }

    const buffer = fs.readFileSync(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": getContentType(filePath),
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to download image",
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}