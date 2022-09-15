import { EntryStorage, StorageEntryPointer, StorageEntryStats, StorageError, StorageErrorCode } from "@storage/EntryStorage";
import { joinNestedPathSecure, StoragePath } from "@storage/StoragePath";
import * as fs from "fs";
import { asyncExists } from "../plugin/PluginManager";


const IGNORED_FILES = [ ".git" ];


export class FsStorage extends EntryStorage {
  constructor(rootPath: string) {
    super();
    this.rootPath = rootPath;
  }


  private readonly rootPath: string;


  override async createDir(path: StoragePath): Promise<StorageEntryPointer> {
    const realPath = this.toAbsolutePath(path);
    try {
      await fs.promises.mkdir(realPath, { recursive: true });
    } catch (err: any) {
      if (err?.code === "EEXIST") {
        throw new StorageError(StorageErrorCode.AlreadyExists, path, "Directory already exists");
      } else {
        throw new StorageError(StorageErrorCode.Unknown, path, err?.message || "Unknown error");
      }
    }

    return new StorageEntryPointer(path, this);
  }


  protected toAbsolutePath(path: StoragePath): string {
    const result = joinNestedPathSecure(this.rootPath, path.normalized);
    if (!result) {
      throw new Error("Path is outside root directory");
    }

    return result;
  }


  override async children(path: StoragePath): Promise<StorageEntryPointer[]> {
    try {
      const entries = await fs.promises.readdir(this.toAbsolutePath(path));
      return entries
        .filter(e => !IGNORED_FILES.includes(e))
        .map(entry => new StorageEntryPointer(path.child(entry), this));
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new StorageError(StorageErrorCode.NotExists, path, "Path does not exist");
      } else if (err.code === "ENOTDIR") {
        throw new StorageError(StorageErrorCode.NotDirectory, path, "Not a directory");
      } else {
        throw new StorageError(StorageErrorCode.Unknown, path, err?.message || "Unknown error");
      }
    }
  }


  override async read(path: StoragePath): Promise<Buffer> {
    try {
      return await fs.promises.readFile(this.toAbsolutePath(path));
    } catch (err: any) {
      if (err.code === "EISDIR") {
        throw new StorageError(StorageErrorCode.NotFile, path, "Cannot read a directory");
      } else if (err.code === "ENOENT") {
        throw new StorageError(StorageErrorCode.NotExists, path, "File does not exist");
      } else {
        throw new StorageError(StorageErrorCode.Unknown, path, err?.message || "Unknown error");
      }
    }
  }


  override async remove(path: StoragePath): Promise<void> {
    try {
      const absPath = this.toAbsolutePath(path);
      const stat = await fs.promises.stat(absPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(absPath, {
          recursive: true
        });
      } else {
        await fs.promises.rm(absPath);
      }
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        throw new StorageError(StorageErrorCode.NotExists, path, "File or directory does not exist");
      } else {
        throw new StorageError(StorageErrorCode.Unknown, path, err?.message || "Unknown error");
      }
    }
  }


  override async stats(path: StoragePath): Promise<StorageEntryStats> {
    const absPath = this.toAbsolutePath(path);
    try {
      const stats = await fs.promises.stat(absPath);
      return {
        isDirectory: stats.isDirectory(),
        size: stats.isDirectory() ? undefined : stats.size,
        createTs: Math.floor(stats.birthtimeMs),
        updateTs: Math.floor(stats.mtimeMs)
      };
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new StorageError(StorageErrorCode.NotExists, path, "Path does not exist");
      } else {
        throw err;
      }
    }
  }


  override async writeOrCreate(path: StoragePath, content: Buffer): Promise<StorageEntryPointer> {
    const absPath = this.toAbsolutePath(path);

    await this.createDir(path.parentDir);

    await fs.promises.writeFile(absPath, content);
    return new StorageEntryPointer(path, this);
  }


  override async exists(path: StoragePath): Promise<boolean> {
    return asyncExists(this.toAbsolutePath(path));
  }
}
