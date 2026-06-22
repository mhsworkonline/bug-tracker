const { execSync } = require("child_process");

const cmd = process.argv[2];
const msg = process.argv.slice(3).join(" ") || "update";

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit" });
}

switch (cmd) {
  case "push":
    run("git add -A");
    run(`git commit -m "${msg}"`);
    run("git push origin main");
    break;

  case "pull":
    run("git pull origin main");
    run("npm install");
    break;

  case "status":
    run("git status");
    run("git log --oneline -10");
    break;

  default:
    console.log(`
Usage:
  node deploy.js push [commit message]   - stage, commit, and push all changes
  node deploy.js pull                    - pull latest + npm install
  node deploy.js status                  - show git status and last 10 commits
`);
}
