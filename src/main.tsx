import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import WorkRouteApp from "./components/WorkRouteApp";
import { isWorkRoute } from "./workRoute";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isWorkRoute() ? <WorkRouteApp /> : <App />}
  </React.StrictMode>
);
