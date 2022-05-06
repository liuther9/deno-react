import React from 'react'
import { hydrateRoot } from 'react-dom/client';
import App from "./App.tsx";
import "../shared/types.ts";

const root = hydrateRoot(document.getElementById("root"));

root.render(<App initialState={globalThis.__INITIAL_STATE__} />,)

delete globalThis.__INITIAL_STATE__;
