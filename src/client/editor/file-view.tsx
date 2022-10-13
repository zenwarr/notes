import { Box, Button, CircularProgress } from "@mui/material";
import { makeStyles } from "@mui/styles";
import { StorageError, StorageErrorCode } from "@storage/entry-storage";
import { StoragePath } from "@storage/storage-path";
import { EditorContext, EditorCtxData } from "editor/editor-context";
import { observer } from "mobx-react-lite";
import * as React from "react";
import { useCallback, useEffect, useMemo } from "react";
import { Document } from "../document/Document";
import { DocumentEditorProvider } from "../document/DocumentEditorProvider";
import { ErrorBoundary } from "../error-boundary/ErrorBoundary";
import { useLoad } from "../useLoad";
import { useWindowTitle } from "../useWindowTitle";
import { useEntrySettingsInsideObserver } from "../workspace/use-entry-settings-inside-observer";
import { Workspace } from "../workspace/workspace";
import { useGlobalEntrySettings } from "./global-entry-settings";


export type FileViewProps = {
  entryPath: StoragePath;
  className?: string;
}


export const FileView = observer((props: FileViewProps) => {
  const classes = useStyles();
  const cw = Workspace.instance;
  const settings = useEntrySettingsInsideObserver(props.entryPath);

  useGlobalEntrySettings(settings);

  const contentLoad = useLoad(useCallback(async () => {
    return await Document.create(Workspace.instance.storage.get(props.entryPath));
  }, [ props.entryPath, cw.editorReloadTrigger ]), {
    onError: err => console.error(`Failed to load file ${ props.entryPath.normalized }`, err),
  });

  useEffect(() => {
    return () => {
      if (contentLoad.data) {
        contentLoad.data.close(); // not handling intentionally
      }
    };
  }, [ contentLoad.data, cw.editorReloadTrigger ]);

  const componentLoad = useLoad(useCallback(async () => {
    if (!contentLoad.isLoaded) {
      return undefined;
    }

    const editorProvider = new DocumentEditorProvider(Workspace.instance.plugins);
    return editorProvider.getComponent(props.entryPath, settings.editor);
  }, [ settings.editor, contentLoad.isLoaded ]));

  const editorCtx: EditorCtxData = useMemo(() => ({
    entryPath: props.entryPath,
  }), [ props.entryPath ]);

  if (contentLoad.loadError) {
    if (contentLoad.loadError instanceof StorageError && contentLoad.loadError.code === StorageErrorCode.NotExists) {
      return <div className={ classes.error }>
        <Box mb={ 2 }>
          File { props.entryPath.normalized } does not exists
        </Box>
        <Button variant={ "contained" }>
          Create
        </Button>
      </div>;
    } else {
      return <div className={ classes.error }>
        { `Error loading "${ props.entryPath.normalized }": ${ contentLoad.loadError }` }
      </div>;
    }
  }

  if (!contentLoad.isLoaded || !componentLoad.isLoaded || !componentLoad.data) {
    return <div className={ classes.loader }>
      <CircularProgress/>
    </div>;
  }

  return <ErrorBoundary>
    <EditorContext.Provider value={ editorCtx }>
      <componentLoad.data doc={ contentLoad.data } className={ props.className }/>
    </EditorContext.Provider>
  </ErrorBoundary>;
});


export interface ConnectedFileViewProps {
  className?: string;
}


export const ConnectedFileView = observer((props: ConnectedFileViewProps) => {
  const openedPath = Workspace.instance.openedPath;

  useWindowTitle(openedPath?.normalized);

  return openedPath ? <FileView entryPath={ openedPath } className={ props.className }/> : null;
});


const useStyles = makeStyles(theme => ({
  loader: {
    padding: theme.spacing(2),
    display: "flex",
    justifyContent: "center"
  },

  error: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    color: theme.palette.error.main,
    justifyContent: "center",
    alignItems: "center"
  }
}));
