const { spawn } = require("child_process");
const path = require("path");

const proc = spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  shell: true,
  cwd: path.dirname(require.main.filename),
});

proc.on("exit", code => process.exit(code ?? 0));
