import * as nodePty from "node-pty";
import type { PtyAdapter } from "./ptyTypes";

export const nodePtyAdapter: PtyAdapter = {
  spawn(command, args, options) {
    return nodePty.spawn(command, args, {
      name: "xterm-256color",
      cwd: options.cwd,
      cols: options.cols,
      rows: options.rows,
      env: options.env,
    });
  },
};
