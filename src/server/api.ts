import { FastifyInstance, FastifyRequest } from "fastify";
import { getProfile, requireAuthenticatedUser } from "./auth";
import { Workspace } from "./workspace";
import S from "fluent-json-schema";
import { EntryType } from "../common/WorkspaceEntry";
import { ErrorCode, LogicError } from "../common/errors";


type WorkspaceRouteParams = {
  workspaceID: string;
}


type FileRouteParams = {
  "*": string;
}


function getWorkspace(req: FastifyRequest<{
  Params: WorkspaceRouteParams
}>): Workspace {
  const profile = getProfile(req);
  const ws = Workspace.getForId(profile.id, req.params.workspaceID);
  if (!ws) {
    throw new LogicError(ErrorCode.EntryNotFound, "workspace not found");
  }

  return ws;
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
    const ws = getWorkspace(req);
    return ws.getAllEntries();
  });


  app.post<{
    Params: WorkspaceRouteParams,
    Body: { parent: string; name: string; type: EntryType }
  }>("/api/workspaces/:workspaceID/files", {
    schema: {
      params: S.object().prop("workspaceID", S.string().required()),
      body: S.object().prop("parent", S.string().required())
      .prop("name", S.string().required())
      .prop("type", S.string().required())
    }
  }, async (req, res) => {
    const ws = getWorkspace(req);
    return ws.createEntry(req.body.parent || "", req.body.name, req.body.type as EntryType);
  });


  app.get<{
    Params: WorkspaceRouteParams & FileRouteParams
  }>("/api/workspaces/:workspaceID/files/*", {
    schema: {
      params: S.object().prop("workspaceID", S.string().required())
      .prop("*", S.string().required())
    }
  }, async (req, res) => {
    const ws = getWorkspace(req);

    const fileID = decodeURIComponent(req.params["*"]);
    return ws.getEntry(fileID);
  });


  app.put<{
    Params: WorkspaceRouteParams & FileRouteParams,
    Body: { content: string }
  }>("/api/workspaces/:workspaceID/files/*", {
    schema: {
      params: S.object().prop("workspaceID", S.string().required())
      .prop("*", S.string().required())
    }
  }, async (req, res) => {
    const fileID = decodeURIComponent(req.params["*"]);

    const ws = getWorkspace(req);

    await ws.saveEntry(fileID, req.body.content);
    return {};
  });
}
