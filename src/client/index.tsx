import * as ReactDOM from "react-dom";
import { App } from "./App";
import { configure } from "mobx";
import { WorkspaceManager } from "./WorkspaceManager";
import { ProfileManager } from "./ProfileManager";
import { Workbox } from "workbox-window";
import { AppThemeProvider } from "./Theme";
import { registerBuiltInPlugins } from "./plugin/BuiltInPlugins";


if ("serviceWorker" in navigator) {
  const wb = new Workbox("/sw.js");
  wb.register().catch(err => {
    console.error("failed to initialize workbox", err);
  });
}


configure({
  enforceActions: "never"
});


const root = document.getElementById("root");
const params = JSON.parse(root?.dataset.params ?? "{}");

WorkspaceManager.instance.id = params.workspaceId;
ProfileManager.instance.userName = params.userName;
registerBuiltInPlugins();

ReactDOM.render(<>
  <AppThemeProvider>
    <App/>
  </AppThemeProvider>
</>, root);
