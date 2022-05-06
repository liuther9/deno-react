import React from "react";
import { Router } from "oak";
import type { Todo } from "../shared/types.ts";
import type { Database } from "./database.ts";
import * as ReactDOMServer from "react-dom/server";

export type RouterConfig = {
  client: string;
  styles: string;
  db: Database;
  devMode?: boolean;
};

const sockets: Set<WebSocket> = new Set();

type RouterInfo = {
  router: Router;
  updateStyles: (styles: string) => void;
};

// Used with the live-reload route to tell when a client is using the mostly
// recently built client code
const serverId = crypto.randomUUID();


export function createRouter(config: RouterConfig): RouterInfo {
  const { db } = config;
  const router = new Router();

  let { client, styles } = config;

  function updateStyles(newStyles: string) {
    styles = newStyles;
    for (const socket of sockets) {
      socket.send("loadStyles");
    }
  }

  router.get("/client.js", ({ response }) => {
    response.type = "application/javascript";
    response.body = client;
  });

  router.get("/styles.css", ({ response }) => {
    response.type = "text/css";
    response.body = styles;
  });

  router.get("/todos", ({ response }) => {
    response.type = "application/json";
    response.body = db.getTodos();
  });

  router.post("/todos", async ({ request, response }) => {
    if (!request.hasBody) {
      response.status = 400;
      response.body = { error: "Missing request body" };
    }

    const body = request.body();
    const data = await body.value as Todo;

    response.type = "application/json";
    response.body = db.addTodo({
      label: data.label,
      complete: data.complete,
    });
  });

  router.patch("/todos/:id", async ({ params, request, response }) => {
    if (!request.hasBody) {
      response.status = 400;
      response.body = { error: "Missing request body" };
    }

    const { id } = params;
    const body = request.body();
    const data = await body.value as Todo;

    response.type = "application/json";
    response.body = db.updateTodo({
      id: Number(id),
      label: data.label,
      complete: data.complete,
    });
  });

  router.delete("/todos/:id", ({ params, response }) => {
    const { id } = params;
    db.removeTodo(Number(id));
    response.status = 204;
  });

  router.get("/livereload/:id", (ctx) => {
    const id = ctx.params.id;
    const socket = ctx.upgrade();
    sockets.add(socket);
    socket.onclose = () => {
      sockets.delete(socket);
    };
    socket.onopen = () => {
      if (id !== serverId) {
        socket.send("reload");
      }
    };
  });

  router.get("/", async ({ response }) => {
    let controller = new AbortController();
    let didError = false;
    try {
      let stream = await ReactDOMServer.renderToReadableStream(
      <html lang="en">
        <head>
          <title>Todos</title>
          <link rel="stylesheet" href="/styles.css" />
          <script type="module" async src="/client.js"></script>
        </head>
        <body>
          <div id="root"></div>
        </body>
      </html>,
        {
          signal: controller.signal,
          onError(error) {
            didError = true;
            console.error(error);
          }
        }
      );

      response.status = didError ? 500 : 200
      response.type = "text/html"
      response.body = stream
    } catch (error) {
      response.status = 500
      response.type = "text/html"
      response.body = '<!doctype html><p>Loading...</p><script src="clientrender.js"></script>'
    }
  });

  return {
    router,
    updateStyles,
  };
}
