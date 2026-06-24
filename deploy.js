const { execSync } = require("child_process");

const args = process.argv.slice(2);
const command = args[0];

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

if (command === "pull") {
  run("git pull origin main");
  run("npm install");
} else {
  const msg = args.slice(1).join(" ") || args[0] || "update";
  run("git add -A");
  try { run(`git commit -m "${msg}"`); } catch { console.log("Nothing to commit, skipping."); }
  run("git push origin main");
  console.log("\nPushed. Vercel will auto-deploy from GitHub.");
}
