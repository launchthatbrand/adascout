import fs from "node:fs";
import path from "node:path";

const sourceRoot = path.resolve("src");
const outputRoot = path.resolve("dist/src");

const copyStyleFiles = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      copyStyleFiles(sourcePath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!sourcePath.endsWith(".css") && !sourcePath.endsWith(".scss")) {
      continue;
    }

    const relativePath = path.relative(sourceRoot, sourcePath);
    const outputPath = path.join(outputRoot, relativePath);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(sourcePath, outputPath);
  }
};

if (fs.existsSync(sourceRoot)) {
  copyStyleFiles(sourceRoot);
}
