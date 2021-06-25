import { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "./auth";
import { Workspace } from "./workspace";
import { writeResult } from "./server-utils";
import S from "fluent-json-schema";
import { EntryType } from "../common/WorkspaceEntry";


type WorkspaceRouteParams = {
  workspaceID: string;
}


type FileRouteParams = {
  fileID: string;
}


export default async function initApiRoutes(app: FastifyInstance) {
  requireAuthenticatedUser(app);

  app.get<{
    Params: WorkspaceRouteParams
  }>("/api/workspaces/:workspaceID/tree", {
    schema: {
      params: S.object().prop("workspaceID", S.string().required())
    }
  }, async (req, res) => {
    const ws = Workspace.getForId(req.params.workspaceID);
    const r = await ws.getAllEntries();

    return writeResult(res, r);
  });


  app.post<{
    Params: WorkspaceRouteParams,
    Body: { parent: string; name?: string; type: EntryType }
  }>("/api/workspaces/:workspaceID/files", {
    schema: {
      params: S.object().prop("workspaceID", S.string().required()),
      body: S.object().prop("parent", S.string().required())
      .prop("name", S.string())
      .prop("type", S.string().required())
    }
  }, async (req, res) => {
    const ws = Workspace.getForId(req.params.workspaceID);
    const r = await ws.createEntry(req.body.parent || "", req.body.name, req.body.type as EntryType);

    return writeResult(res, r);
  });


  app.get<{
    Params: WorkspaceRouteParams & FileRouteParams
  }>("/api/workspaces/:workspaceID/files/:fileID", {
    schema: {
      params: S.object().prop("workspaceID", S.string().required())
      .prop("fileID", S.string().required())
    }
  }, async (req, res) => {
    const fileID = decodeURIComponent(req.params.fileID);
    const ws = Workspace.getForId(req.params.workspaceID);
    const r = await ws.getEntry(fileID);

    return writeResult(res, r);
  });


  app.put<{
    Params: WorkspaceRouteParams & FileRouteParams,
    Body: { content: string }
  }>("/api/workspaces/:workspaceID/files/:fileID", {
    schema: {
      params: S.object().prop("workspaceID", S.string().required())
      .prop("fileID", S.string().required())
    }
  }, async (req, res) => {
    const fileID = decodeURIComponent(req.params.fileID);

    const ws = Workspace.getForId(req.params.workspaceID);
    const r = await ws.saveEntry(fileID, req.body.content);

    return writeResult(res, r);
  });
}
