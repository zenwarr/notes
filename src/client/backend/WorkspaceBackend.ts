import ky from "ky";
import { EntryInfo, WorkspaceEntry } from "../../common/WorkspaceEntry";


export class WorkspaceBackend {
  async loadTree() {
    return ky("/api/workspaces/default/tree").json<WorkspaceEntry[]>();
  }


  async createEntry(path: string, type: "file" | "dir"): Promise<WorkspaceEntry[]> {
    return ky.post("/api/workspaces/default/files", {
      json: {
        path,
        type
      }
    }).json<WorkspaceEntry[]>();
  }


  async getEntry(entryPath: string): Promise<EntryInfo> {
    return ky(`/api/workspaces/default/files/${ encodeURIComponent(entryPath) }`).json<EntryInfo>();
  }


  async saveEntry(entryPath: string, content: string): Promise<void> {
    await ky.put(`/api/workspaces/default/files/${ encodeURIComponent(entryPath) }`, {
      json: {
        content
      }
    }).json<EntryInfo>();
  }
}


const DEMO_WORKSPACE: WorkspaceEntry[] = [
  {
    type: "file",
    id: "file.md",
    name: "file.md"
  },
  {
    type: "dir",
    id: "dir",
    name: "dir",
    children: [
      {
        type: "file",
        id: "dir/nested.md",
        name: "nested.md"
      }
    ]
  }
];


export class TestWorkspaceBackend implements WorkspaceBackend {
  async loadTree(): Promise<WorkspaceEntry[]> {
    return DEMO_WORKSPACE;
  }


  async createEntry(path: string, type: "file" | "dir"): Promise<WorkspaceEntry[]> {
    console.log("create entry:", path, type);
    return DEMO_WORKSPACE;
  }


  async getEntry(entryPath: string): Promise<EntryInfo> {
    if (entryPath === "file.md" || entryPath === "dir/nested.md") {
      return {
        content: "File content\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n1\n2\n"
      };
    } else {
      throw new Error("Entry not found");
    }
  }


  async saveEntry(entryPath: string, content: string): Promise<void> {
    console.log("save entry", entryPath, content);
  }
}
