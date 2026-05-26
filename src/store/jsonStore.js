import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export class JsonStore {
  constructor(root = process.env.DATA_DIR ?? "./data") {
    this.root = root;
  }

  path(...parts) {
    return join(this.root, ...parts);
  }

  async readJson(path, fallback = null) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return fallback;
      throw error;
    }
  }

  async writeJson(path, value) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  async saveRaw(date, results) {
    await this.writeJson(this.path("raw", `${date}.json`), results);
  }

  async saveItems(date, items) {
    await this.writeJson(this.path("items", `${date}.json`), items);
  }

  async saveDigest(date, digest) {
    await this.writeJson(this.path("digests", `${date}.json`), digest);
    await this.writeJson(this.path("digests", "latest.json"), digest);
  }

  async saveStatus(status) {
    await this.writeJson(this.path("source-status.json"), status);
  }

  async latestDigest() {
    return this.readJson(this.path("digests", "latest.json"), null);
  }

  async digest(date) {
    return this.readJson(this.path("digests", `${date}.json`), null);
  }

  async items(date) {
    return this.readJson(this.path("items", `${date}.json`), []);
  }

  async sourceStatus() {
    return this.readJson(this.path("source-status.json"), []);
  }

  async digestDates() {
    try {
      const files = await readdir(this.path("digests"));
      return files
        .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
        .map((file) => file.replace(".json", ""))
        .sort()
        .reverse();
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
}
